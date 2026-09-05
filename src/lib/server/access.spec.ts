import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test'
	}
}));
vi.mock('$env/dynamic/private', () => ({ env: { SUPABASE_SERVICE_ROLE_KEY: 'test-not-a-key' } }));
import { requireAccount, requireSameOrigin } from './access';

describe('authenticated write boundary', () => {
	it('rejects anonymous requests', () => {
		expect(() => requireAccount({ locals: { user: null } } as RequestEvent)).toThrow();
	});
	it('returns only the server-verified user', () => {
		expect(requireAccount({ locals: { user: { id: 'verified' } } } as RequestEvent).id).toBe(
			'verified'
		);
	});
	it('rejects foreign and missing origins', () => {
		for (const origin of [null, 'https://foreign.example']) {
			const request = new Request('https://app.example/api/turns', {
				method: 'POST',
				headers: origin ? { origin } : {}
			});
			expect(() =>
				requireSameOrigin({ request, url: new URL(request.url) } as RequestEvent)
			).toThrow();
		}
	});
});
