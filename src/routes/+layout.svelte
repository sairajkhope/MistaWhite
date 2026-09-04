<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="MistaWhite is a character-first field scientist for running personal experiments."
	/>
</svelte:head>

{@render children()}
