import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { storageReady } from '$lib/server/access';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return { configured: storageReady() };
};

export const actions: Actions = {
	send: async ({ request, locals }) => {
		if (!locals.supabase || !storageReady())
			return fail(503, { message: 'Account storage is not configured yet.', email: '' });
		const form = await request.formData();
		const parsed = z.email().max(254).safeParse(form.get('email'));
		if (!parsed.success) return fail(400, { message: 'Enter a valid email address.', email: '' });
		const { error } = await locals.supabase.auth.signInWithOtp({ email: parsed.data });
		if (error)
			return fail(429, {
				message: 'Could not send a code. Please wait before trying again.',
				email: parsed.data
			});
		return { message: 'Check your email for a sign-in code.', email: parsed.data };
	},
	verify: async ({ request, locals }) => {
		if (!locals.supabase) return fail(503, { message: 'Sign-in is unavailable.', email: '' });
		const form = await request.formData();
		const parsed = z
			.object({ email: z.email().max(254), token: z.string().regex(/^\d{6,10}$/) })
			.safeParse(Object.fromEntries(form));
		if (!parsed.success)
			return fail(400, { message: 'Enter your email and the code from your inbox.', email: '' });
		const { error } = await locals.supabase.auth.verifyOtp({ ...parsed.data, type: 'email' });
		if (error)
			return fail(400, {
				message: 'That code is invalid or expired. Request a new one.',
				email: parsed.data.email
			});
		redirect(303, '/');
	}
};
