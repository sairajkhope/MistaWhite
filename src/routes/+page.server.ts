import { redirect } from '@sveltejs/kit';
import { storageReady } from '$lib/server/access';
import { loadLedger } from '$lib/server/ledger';
import { createLocalRuntime } from '$lib/agent/local-runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!storageReady())
		return {
			configured: false,
			email: null,
			revision: 0,
			runtime: createLocalRuntime('preview'),
			turns: []
		};
	if (!locals.user) redirect(303, '/login');
	return {
		configured: true,
		email: locals.user.email ?? '',
		...(await loadLedger(locals.user.id))
	};
};
