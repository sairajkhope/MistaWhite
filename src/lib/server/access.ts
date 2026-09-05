import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { error, type RequestEvent } from '@sveltejs/kit';

export function storageReady() {
	return Boolean(
		publicEnv.PUBLIC_SUPABASE_URL &&
		publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
		env.SUPABASE_SERVICE_ROLE_KEY
	);
}

// This module cannot be imported by a browser bundle. All callers must first verify identity.
export function adminClient() {
	if (!storageReady()) error(503, 'Account storage has not been configured.');
	return createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

export function requireAccount(event: RequestEvent) {
	if (!storageReady()) error(503, 'Account storage has not been configured.');
	if (!event.locals.user) error(401, 'Sign in to continue.');
	return event.locals.user;
}

export function requireSameOrigin(event: RequestEvent) {
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Cross-origin write rejected.');
}
