<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { JudgmentRoute } from '$lib/agent/contracts';

	let { data }: { data: PageData } = $props();
	type Message = { id: string; speaker: 'you' | 'mistawhite'; text: string; meta?: string };
	type AudioItem = { id: string; duration: number; url: string };
	let runtime = $state(untrack(() => data.runtime));
	let revision = $state(untrack(() => data.revision));
	let draft = $state('');
	let busy = $state(false);
	let notice = $state('');
	let pending: {
		id: string;
		content: string;
		occurredAt: string;
		expectedRevision: number;
	} | null = $state(null);
	let lastRoute: JudgmentRoute = $state('deterministic');
	function thread(turns: PageData['turns']): Message[] {
		return turns.flatMap((turn) => [
			{ id: turn.id, speaker: 'you' as const, text: turn.input.content, meta: 'SAVED NOTE' },
			{
				id: turn.id + ':reply',
				speaker: 'mistawhite' as const,
				text: turn.response.text,
				meta: 'MISTAWHITE'
			}
		]);
	}
	let messages = $state<Message[]>(untrack(() => thread(data.turns)));
	$effect(() => {
		runtime = data.runtime;
		revision = data.revision;
		messages = thread(data.turns);
	});
	const stanceLabel = $derived(runtime.character.stance.replaceAll('-', ' '));
	const irritation = $derived(
		Math.round(Math.max(...Object.values(runtime.character.irritation)) * 100)
	);
	const curiosity = $derived(Math.round(runtime.character.curiosity * 100));
	let recordings = $state<AudioItem[]>([]);
	let localAudio = $state<{ id: string; blob: Blob; url: string; duration: number } | null>(null);
	let audioBusy = $state(false);
	let audioNotice = $state('');
	let isRecording = $state(false);
	let acquiring = $state(false);
	let recorder: MediaRecorder | null = null;
	let stream: MediaStream | null = null;
	let started = 0;
	let chunks: Blob[] = [];
	let stopTimer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	const localUrls = new Set<string>();

	async function request<T>(url: string, payload?: unknown): Promise<T> {
		const response = await fetch(
			url,
			payload === undefined
				? {}
				: {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					}
		);
		const body = await response.json();
		if (!response.ok) throw new Error(body.message ?? 'Request failed. Please retry.');
		return body;
	}
	async function refreshNotebook() {
		if (!data.configured || busy) return;
		busy = true;
		try {
			const saved = await request<{
				runtime: typeof runtime;
				revision: number;
				turns: PageData['turns'];
			}>('/api/turns');
			runtime = saved.runtime;
			revision = saved.revision;
			messages = thread(saved.turns);
			if (pending) pending.expectedRevision = revision;
			notice = 'Notebook refreshed. Your draft has been kept.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not refresh.';
		} finally {
			busy = false;
		}
	}
	async function submitText() {
		if (!data.configured || busy || (!draft.trim() && !pending)) return;
		busy = true;
		notice = 'Saving…';
		pending ??= {
			id: crypto.randomUUID(),
			content: draft.trim(),
			occurredAt: new Date().toISOString(),
			expectedRevision: revision
		};
		try {
			const saved = await request<{
				runtime: typeof runtime;
				revision: number;
				turns: PageData['turns'];
			}>('/api/turns', pending);
			runtime = saved.runtime;
			revision = saved.revision;
			messages = thread(saved.turns);
			lastRoute = saved.turns.at(-1)?.response.route ?? 'deterministic';
			draft = '';
			pending = null;
			notice = 'Saved to your account.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Save not confirmed. Retry this note.';
		} finally {
			busy = false;
		}
	}
	function handleComposerKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			void submitText();
		}
	}
	async function refreshAudio() {
		try {
			recordings = await request<AudioItem[]>('/api/audio');
		} catch (error) {
			audioNotice = error instanceof Error ? error.message : 'Could not load recordings.';
		}
	}
	onMount(() => {
		if (data.configured) void refreshAudio();
	});
	onDestroy(() => {
		disposed = true;
		clearTimeout(stopTimer);
		if (recorder?.state === 'recording') recorder.stop();
		stream?.getTracks().forEach((track) => track.stop());
		localUrls.forEach((url) => URL.revokeObjectURL(url));
	});
	async function toggleRecording() {
		if (isRecording && recorder) {
			recorder.stop();
			return;
		}
		if (!data.configured || acquiring || localAudio) return;
		if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
			audioNotice = 'Recording is unavailable in this browser. You can still write a note.';
			return;
		}
		acquiring = true;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (disposed) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			chunks = [];
			recorder = new MediaRecorder(stream);
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
				if (
					chunks.reduce((sum, chunk) => sum + chunk.size, 0) > 25 * 1024 * 1024 &&
					recorder?.state === 'recording'
				)
					recorder.stop();
			};
			recorder.onstop = () => {
				clearTimeout(stopTimer);
				const mime = recorder?.mimeType || 'audio/webm';
				stream?.getTracks().forEach((track) => track.stop());
				isRecording = false;
				stream = null;
				recorder = null;
				if (disposed) return;
				const blob = new Blob(chunks, { type: mime });
				const url = URL.createObjectURL(blob);
				localUrls.add(url);
				localAudio = {
					id: crypto.randomUUID(),
					blob,
					url,
					duration: Math.min(300, Math.round((Date.now() - started) / 1000))
				};
				audioNotice = 'Recorded on this device. Save privately to keep it after closing the page.';
			};
			recorder.start(1000);
			started = Date.now();
			isRecording = true;
			stopTimer = setTimeout(() => {
				if (recorder?.state === 'recording') recorder.stop();
			}, 299000);
		} catch {
			stream?.getTracks().forEach((track) => track.stop());
			audioNotice = 'Microphone unavailable. Check permission and try again.';
		} finally {
			acquiring = false;
		}
	}
	async function uploadAudio() {
		if (!localAudio || audioBusy) return;
		audioBusy = true;
		audioNotice = 'Saving your recording…';
		const item = localAudio;
		try {
			const prepared = await request<{ alreadyUploaded: boolean; signedUrl: string | null }>(
				'/api/audio',
				{
					id: item.id,
					mime: item.blob.type.split(';')[0],
					size: item.blob.size,
					duration: item.duration
				}
			);
			if (!prepared.alreadyUploaded && prepared.signedUrl) {
				const result = await fetch(prepared.signedUrl, {
					method: 'PUT',
					headers: { 'Content-Type': item.blob.type.split(';')[0] },
					body: item.blob
				});
				if (!result.ok)
					throw new Error('Upload was not confirmed. Your recording is still here; retry saving.');
			}
			await request('/api/audio?action=complete', { id: item.id });
			URL.revokeObjectURL(item.url);
			localUrls.delete(item.url);
			localAudio = null;
			await refreshAudio();
			audioNotice = 'Saved privately. Not transcribed or analysed yet.';
		} catch (error) {
			audioNotice =
				error instanceof Error ? error.message : 'Could not save. Retry this recording.';
		} finally {
			audioBusy = false;
		}
	}
	function discardLocalAudio() {
		if (!localAudio || audioBusy) return;
		if (!confirm('Discard this unsaved recording from this device?')) return;
		URL.revokeObjectURL(localAudio.url);
		localUrls.delete(localAudio.url);
		localAudio = null;
		audioNotice = 'Unsaved recording discarded from this device.';
	}
</script>

<svelte:head>
	<title>MistaWhite — Field Console</title>
</svelte:head>

<main class="shell">
	<header class="topbar">
		<div class="identity">
			<div class="monogram" aria-hidden="true"><span>MW</span></div>
			<div>
				<p class="eyebrow">PRIVATE FIELD CONSOLE</p>
				<h1>MistaWhite</h1>
			</div>
		</div>
		<div class="presence"><span>{stanceLabel}</span></div>
	</header>
	<div class="account-bar">
		{#if data.configured}
			<span>{data.email}</span>
			<button type="button" onclick={refreshNotebook} disabled={busy}>Refresh notebook</button>
			<form method="POST" action="/logout"><button>Sign out</button></form>
		{:else}
			<p>
				Preview only. Account storage must be connected before notes or recordings can be saved.
			</p>
			<a href="/login">Account setup status</a>
		{/if}
	</div>

	<section class="workspace">
		<aside class="character-panel">
			<div class="aperture" aria-label="MistaWhite is present">
				<div class="aperture-ring ring-one"></div>
				<div class="aperture-ring ring-two"></div>
				<div class="pupil">MW</div>
			</div>

			<div class="stance-copy">
				<p class="eyebrow">CURRENT STANCE</p>
				<h2>{stanceLabel}</h2>
				<p>Curious about the evidence. Impatient with conclusions that arrive before it.</p>
			</div>

			<div class="meters">
				<div class="meter-row">
					<span>curiosity</span><b>{curiosity}%</b>
					<div class="track"><i style={`width: ${curiosity}%`}></i></div>
				</div>
				<div class="meter-row irritation">
					<span>irritation</span><b>{irritation}%</b>
					<div class="track"><i style={`width: ${irritation}%`}></i></div>
				</div>
			</div>

			<div class="ledger">
				<div><strong>{runtime.kernel.observations.length}</strong><span>observations</span></div>
				<div><strong>{runtime.kernel.revision}</strong><span>revisions</span></div>
				<div>
					<strong>{runtime.character.unresolvedThreads.length}</strong><span>open threads</span>
				</div>
			</div>
		</aside>

		<section class="console" aria-label="Conversation with MistaWhite">
			<div class="console-header">
				<div>
					<p class="eyebrow">TODAY / LIVE INTAKE</p>
					<h2>What are we looking at?</h2>
				</div>
				<span class="route">route: {lastRoute}</span>
			</div>

			<div class="thread" aria-live="polite">
				{#if messages.length === 0}<p>
						Start anywhere. Tell me what happened, not what it proves about you.
					</p>{/if}
				{#each messages as message (message.id)}
					<article class:from-user={message.speaker === 'you'} class="message">
						<header>
							<span>{message.speaker === 'you' ? 'YOU' : 'MISTAWHITE'}</span><time
								>{message.meta}</time
							>
						</header>
						<p>{message.text}</p>
					</article>
				{/each}
			</div>

			<div class="composer">
				<label for="field-note">Give me an observation</label>
				<div class="composer-row">
					<textarea
						id="field-note"
						bind:value={draft}
						disabled={!data.configured || busy || pending !== null}
						maxlength="12000"
						onkeydown={handleComposerKeydown}
						rows="2"
						placeholder="What happened? What did you notice?"></textarea>
					<button
						class:recording={isRecording}
						class="record"
						type="button"
						onclick={toggleRecording}
						disabled={!data.configured || acquiring || localAudio !== null}
						aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}><i></i></button
					>
					<button
						class="send"
						type="button"
						onclick={submitText}
						disabled={!data.configured || busy || (!draft.trim() && !pending)}
						aria-label="Send observation">↗</button
					>
				</div>
				<p class="composer-note">
					{isRecording
						? 'Recording — press the red control to stop'
						: 'Enter to send · Shift + Enter for a new line'}
				</p>
				<p role="status" class="save-status">{notice}</p>
				{#if pending && !busy}<button class="utility" onclick={submitText}
						>Retry saving this note</button
					>{/if}
			</div>
			<section class="audio-library" aria-label="Your recordings">
				<h3>Field recordings</h3>
				<p>Saved audio is private. Transcription and analysis are not connected yet.</p>
				{#if localAudio}
					<p>{localAudio.duration}s · not saved yet</p>
					<audio controls src={localAudio.url}><track kind="captions" /></audio>
					<button class="utility" onclick={uploadAudio} disabled={audioBusy}>Save privately</button>
					<button class="utility" onclick={discardLocalAudio} disabled={audioBusy}
						>Discard local recording</button
					>
				{/if}
				<p role="status">{audioNotice}</p>
				{#if data.configured}<button class="utility" onclick={refreshAudio}
						>Refresh recordings and playback links</button
					>{/if}
				{#each recordings as recording (recording.id)}
					<p>{recording.duration}s · saved, untranscribed</p>
					<audio controls src={recording.url}><track kind="captions" /></audio>
				{/each}
			</section>
		</section>
	</section>
</main>

<style>
	.account-bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
		padding: 16px 0;
		font-size: 14px;
	}
	.account-bar p {
		margin: 0;
	}
	.account-bar button,
	.utility {
		color: var(--paper);
		background: var(--panel);
		border: 1px solid var(--line);
		padding: 10px;
		cursor: pointer;
		font-size: 14px;
	}
	.account-bar a {
		color: var(--amber);
	}
	.audio-library {
		margin-top: 24px;
		padding: 16px 0;
		border-top: 1px solid var(--line);
	}
	.audio-library p {
		font-size: 14px;
		color: var(--muted);
		line-height: 1.6;
	}
	.save-status {
		font-size: 14px;
		line-height: 1.5;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.shell {
		width: min(1280px, 100%);
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 28px 28px;
	}
	.topbar {
		height: 92px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.monogram {
		width: 46px;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px solid var(--signal);
		border-radius: 50%;
		color: var(--signal);
		font: 500 11px 'DM Mono';
		position: relative;
	}
	.monogram::after {
		content: '';
		position: absolute;
		inset: 5px;
		border: 1px solid rgba(232, 91, 63, 0.35);
		border-radius: inherit;
		border-left-color: transparent;
		transform: rotate(35deg);
	}
	.eyebrow {
		margin: 0 0 5px;
		color: var(--muted);
		font: 400 10px/1.3 'DM Mono';
		letter-spacing: 0.17em;
	}
	h1 {
		margin: 0;
		font-size: 18px;
		letter-spacing: -0.02em;
	}
	.presence {
		display: flex;
		align-items: center;
		gap: 9px;
		color: var(--muted);
		font: 400 10px 'DM Mono';
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.workspace {
		min-height: calc(100vh - 120px);
		display: grid;
		grid-template-columns: minmax(280px, 0.78fr) minmax(520px, 1.7fr);
	}
	.character-panel {
		padding: 56px 52px 32px 10px;
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
	}
	.aperture {
		width: min(238px, 78%);
		aspect-ratio: 1;
		border-radius: 50%;
		margin: 4px auto 54px;
		position: relative;
		display: grid;
		place-items: center;
		background: radial-gradient(
			circle,
			rgba(232, 91, 63, 0.17) 0 4%,
			transparent 5% 25%,
			rgba(213, 168, 77, 0.05) 26% 27%,
			transparent 28%
		);
	}
	.aperture-ring {
		position: absolute;
		border-radius: 50%;
		border: 1px solid var(--line);
	}
	.ring-one {
		inset: 8%;
		border-right-color: var(--signal);
		transform: rotate(-25deg);
	}
	.ring-two {
		inset: 23%;
		border-top-color: var(--amber);
		border-left-color: rgba(232, 91, 63, 0.5);
		transform: rotate(17deg);
	}
	.pupil {
		width: 44px;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border-radius: 50%;
		color: var(--paper);
		background: #171416;
		box-shadow: 0 0 28px rgba(232, 91, 63, 0.2);
		font: 500 10px 'DM Mono';
		letter-spacing: 0.08em;
	}
	.stance-copy h2,
	.console-header h2 {
		margin: 0;
		font-weight: 500;
		letter-spacing: -0.035em;
	}
	.stance-copy h2 {
		font-size: clamp(24px, 3vw, 36px);
		text-transform: capitalize;
	}
	.stance-copy > p:last-child {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.7;
		max-width: 310px;
	}
	.meters {
		margin-top: 34px;
		display: grid;
		gap: 18px;
	}
	.meter-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 7px;
		color: var(--muted);
		font: 400 10px 'DM Mono';
		letter-spacing: 0.08em;
	}
	.meter-row b {
		color: var(--paper);
		font-weight: 400;
	}
	.track {
		grid-column: 1 / -1;
		height: 2px;
		background: var(--line);
	}
	.track i {
		display: block;
		height: 100%;
		background: var(--amber);
		transition: width 0.35s ease;
	}
	.irritation .track i {
		background: var(--signal);
	}
	.ledger {
		margin-top: auto;
		padding-top: 40px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 9px;
	}
	.ledger div {
		border-top: 1px solid var(--line);
		padding-top: 10px;
		display: grid;
		gap: 4px;
	}
	.ledger strong {
		font: 300 19px 'DM Mono';
	}
	.ledger span {
		color: var(--faint);
		font: 400 8px 'DM Mono';
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.console {
		min-height: calc(100vh - 120px);
		padding: 52px 12px 10px 54px;
		display: flex;
		flex-direction: column;
	}
	.console-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--line);
	}
	.console-header h2 {
		font-size: clamp(23px, 3vw, 34px);
	}
	.route {
		color: var(--faint);
		font: 400 9px 'DM Mono';
		text-transform: uppercase;
	}
	.thread {
		flex: 1;
		max-height: calc(100vh - 360px);
		min-height: 250px;
		overflow-y: auto;
		padding: 12px 3px 26px;
		scrollbar-color: var(--line) transparent;
	}
	.message {
		width: min(580px, 88%);
		margin: 26px 0;
	}
	.message.from-user {
		margin-left: auto;
		padding-left: 42px;
	}
	.message header {
		display: flex;
		gap: 12px;
		color: var(--signal);
		font: 500 9px 'DM Mono';
		letter-spacing: 0.11em;
	}
	.message.from-user header {
		color: var(--amber);
	}
	.message time {
		color: var(--faint);
		font-weight: 400;
	}
	.message p {
		margin: 9px 0 0;
		font-size: 15px;
		line-height: 1.7;
		color: #d8d4cc;
	}
	.message.from-user p {
		color: var(--paper);
	}
	audio {
		width: 100%;
		height: 32px;
		margin-top: 12px;
		opacity: 0.72;
	}
	.composer {
		position: sticky;
		bottom: 0;
		padding: 17px 18px 12px;
		background: rgba(16, 15, 16, 0.94);
		border: 1px solid var(--line);
		box-shadow: 0 -16px 38px rgba(11, 11, 13, 0.65);
		backdrop-filter: blur(14px);
	}
	.composer label {
		display: block;
		margin-bottom: 9px;
		color: var(--muted);
		font: 400 9px 'DM Mono';
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.composer-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	textarea {
		flex: 1;
		resize: none;
		border: 0;
		padding: 5px 0;
		background: transparent;
		color: var(--paper);
		font-size: 14px;
		line-height: 1.5;
	}
	textarea::placeholder {
		color: var(--faint);
	}
	.record,
	.send {
		flex: none;
		border-radius: 50%;
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.record {
		width: 39px;
		aspect-ratio: 1;
		border: 1px solid var(--line);
		background: transparent;
	}
	.record i {
		width: 9px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--signal);
	}
	.record.recording {
		border-color: var(--signal);
		animation: pulse 1.4s infinite;
	}
	.record.recording i {
		border-radius: 2px;
	}
	.send {
		width: 39px;
		aspect-ratio: 1;
		border: 0;
		background: var(--paper);
		color: #111;
		font-size: 18px;
	}
	.send:disabled {
		opacity: 0.2;
		cursor: default;
	}
	.composer-note {
		margin: 9px 0 0;
		color: var(--faint);
		font: 400 8px 'DM Mono';
		letter-spacing: 0.04em;
	}
	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 5px rgba(232, 91, 63, 0.08);
		}
	}
	@media (max-width: 760px) {
		.shell {
			padding: 0 16px 16px;
		}
		.topbar {
			height: 76px;
		}
		.workspace {
			display: block;
		}
		.character-panel {
			padding: 30px 0 24px;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
		.aperture {
			width: 118px;
			margin: 0 0 24px;
		}
		.stance-copy > p:last-child {
			margin-bottom: 0;
		}
		.meters {
			display: none;
		}
		.ledger {
			margin-top: 20px;
			padding-top: 0;
		}
		.console {
			min-height: 620px;
			padding: 30px 0 0;
		}
		.route {
			display: none;
		}
		.thread {
			max-height: none;
			min-height: 300px;
		}
		.message {
			width: 94%;
		}
	}
</style>
