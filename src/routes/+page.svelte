<script lang="ts">
	import {
		createLocalRuntime,
		runLocalTurn,
		type JudgmentRoute,
		type LocalRuntimeState
	} from '$lib';

	type ThreadMessage = {
		id: string;
		speaker: 'you' | 'mistawhite';
		text: string;
		meta?: string;
		audioUrl?: string;
	};

	const userId = 'local-prototype-user';
	let runtime: LocalRuntimeState = $state(createLocalRuntime(userId));
	let draft = $state('');
	let isRecording = $state(false);
	let recordingStartedAt = $state<number | null>(null);
	let recorder: MediaRecorder | null = null;
	let recordingStream: MediaStream | null = null;
	let audioChunks: Blob[] = [];
	let lastRoute: JudgmentRoute = $state('deterministic');
	let messages: ThreadMessage[] = $state([
		{
			id: 'opening',
			speaker: 'mistawhite',
			text: 'Start anywhere. Tell me what happened, not what it proves about you.',
			meta: 'FIELD NOTE 00'
		}
	]);

	const stanceLabel = $derived(runtime.character.stance.replaceAll('-', ' '));
	const irritation = $derived(
		Math.round(Math.max(...Object.values(runtime.character.irritation)) * 100)
	);
	const curiosity = $derived(Math.round(runtime.character.curiosity * 100));

	function submitText() {
		const content = draft.trim();
		if (!content) return;

		const id = crypto.randomUUID();
		const result = runLocalTurn(runtime, {
			id,
			userId,
			channel: 'text',
			content,
			occurredAt: new Date().toISOString(),
			sourceId: `browser:${id}`
		});

		messages.push(
			{ id, speaker: 'you', text: content, meta: 'RAW OBSERVATION' },
			{
				id: crypto.randomUUID(),
				speaker: 'mistawhite',
				text: result.displayText,
				meta: result.judgmentRoute.toUpperCase().replace('-', ' ')
			}
		);
		runtime = { kernel: result.kernelState, character: result.characterState };
		lastRoute = result.judgmentRoute;
		draft = '';
	}

	function handleComposerKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submitText();
		}
	}

	async function toggleRecording() {
		if (isRecording && recorder) {
			recorder.stop();
			return;
		}

		if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
			messages.push({
				id: crypto.randomUUID(),
				speaker: 'mistawhite',
				text: 'This browser cannot record audio. Use text here; the evidence is no less real.',
				meta: 'DEVICE LIMIT'
			});
			return;
		}

		try {
			recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioChunks = [];
			recorder = new MediaRecorder(recordingStream);
			recorder.addEventListener('dataavailable', (event) => {
				if (event.data.size) audioChunks.push(event.data);
			});
			recorder.addEventListener('stop', saveRecording, { once: true });
			recorder.start();
			recordingStartedAt = Date.now();
			isRecording = true;
		} catch {
			messages.push({
				id: crypto.randomUUID(),
				speaker: 'mistawhite',
				text: 'The microphone stayed closed. I will not pretend I heard you.',
				meta: 'PERMISSION REQUIRED'
			});
		}
	}

	function saveRecording() {
		const duration = recordingStartedAt
			? Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000))
			: 0;
		const type = recorder?.mimeType || 'audio/webm';
		const blob = new Blob(audioChunks, { type });
		const audioUrl = URL.createObjectURL(blob);

		messages.push(
			{
				id: crypto.randomUUID(),
				speaker: 'you',
				text: `${duration}s field recording`,
				meta: 'LOCAL AUDIO · UNTRANSCRIBED',
				audioUrl
			},
			{
				id: crypto.randomUUID(),
				speaker: 'mistawhite',
				text: 'Captured locally. The original stays separate from anything I infer. Transcription joins when the private storage adapter does.',
				meta: 'PROVENANCE KEPT'
			}
		);
		recordingStream?.getTracks().forEach((track) => track.stop());
		recordingStream = null;
		recorder = null;
		isRecording = false;
		recordingStartedAt = null;
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
		<div class="presence"><i></i><span>{stanceLabel}</span></div>
	</header>

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
				{#each messages as message (message.id)}
					<article class:from-user={message.speaker === 'you'} class="message">
						<header>
							<span>{message.speaker === 'you' ? 'YOU' : 'MISTAWHITE'}</span><time
								>{message.meta}</time
							>
						</header>
						<p>{message.text}</p>
						{#if message.audioUrl}
							<audio controls src={message.audioUrl}><track kind="captions" /></audio>
						{/if}
					</article>
				{/each}
			</div>

			<div class="composer">
				<label for="field-note">Give me an observation</label>
				<div class="composer-row">
					<textarea
						id="field-note"
						bind:value={draft}
						onkeydown={handleComposerKeydown}
						rows="2"
						placeholder="What happened? What did you notice?"></textarea>
					<button
						class:recording={isRecording}
						class="record"
						type="button"
						onclick={toggleRecording}
						aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}><i></i></button
					>
					<button
						class="send"
						type="button"
						onclick={submitText}
						disabled={!draft.trim()}
						aria-label="Send observation">↗</button
					>
				</div>
				<p class="composer-note">
					{isRecording
						? 'Recording — press the red control to stop'
						: 'Enter to send · Shift + Enter for a new line · voice stays local in this prototype'}
				</p>
			</div>
		</section>
	</section>
</main>

<style>
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
	.presence i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--amber);
		box-shadow: 0 0 12px var(--amber);
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
