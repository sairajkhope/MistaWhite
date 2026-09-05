<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<svelte:head><title>Sign in · MistaWhite</title></svelte:head>
<main>
	<a href="/">MistaWhite</a>
	<h1>A place to pick up the thread.</h1>
	<p>
		Sign in or create an account with your email. Your notes and recordings belong to your account.
	</p>
	{#if !data.configured}
		<p role="status">
			Account storage is not connected yet. The operator needs to complete Supabase setup.
		</p>
	{:else}
		<form method="POST" action="?/send" use:enhance>
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				value={form?.email ?? ''}
				required
			/>
			<button>Send sign-in code</button>
		</form>
		<form method="POST" action="?/verify" use:enhance>
			<label for="verify-email">Email for this code</label>
			<input
				id="verify-email"
				name="email"
				type="email"
				autocomplete="email"
				value={form?.email ?? ''}
				required
			/>
			<label for="code">Code from your inbox</label>
			<input
				id="code"
				name="token"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern={'[0-9]{6,10}'}
				required
			/>
			<button>Continue</button>
		</form>
	{/if}
	{#if form?.message}<p role="status">{form.message}</p>{/if}
</main>

<style>
	main {
		max-width: 480px;
		margin: 8vh auto;
		padding: 24px;
	}
	h1 {
		font-size: 2rem;
		font-weight: 500;
	}
	p {
		color: var(--muted);
		line-height: 1.7;
	}
	a {
		color: var(--signal);
	}
	form {
		display: grid;
		gap: 12px;
		margin: 28px 0;
	}
	input,
	button {
		padding: 14px;
		border: 1px solid var(--line);
		font: inherit;
	}
	input {
		background: var(--panel);
		color: var(--paper);
	}
	button {
		background: var(--paper);
		color: #111;
		cursor: pointer;
	}
</style>
