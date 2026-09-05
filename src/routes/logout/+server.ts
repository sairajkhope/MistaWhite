import { error, redirect } from '@sveltejs/kit';
import { requireSameOrigin } from '$lib/server/access';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	requireSameOrigin(event);
	const result = await event.locals.supabase?.auth.signOut({ scope: 'local' });
	if (result?.error) error(503, 'Sign-out failed. Please retry.');
	redirect(303, '/login');
};
