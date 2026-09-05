import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.supabase = null;
	if (env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
		const client = createServerClient(
			env.PUBLIC_SUPABASE_URL,
			env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			{
				cookies: {
					getAll: () => event.cookies.getAll(),
					setAll: (cookies) =>
						cookies.forEach(({ name, value, options }) =>
							event.cookies.set(name, value, {
								...options,
								path: '/',
								httpOnly: true,
								sameSite: 'lax',
								secure: event.url.protocol === 'https:'
							})
						)
				}
			}
		);
		event.locals.supabase = client;
		const { data, error } = await client.auth.getUser();
		if (!error) event.locals.user = data.user;
	}
	const response = await resolve(event);
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('Referrer-Policy', 'no-referrer');
	return response;
};
