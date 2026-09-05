import { error, json } from '@sveltejs/kit';
import { requireAccount, requireSameOrigin } from '$lib/server/access';
import { loadLedger, saveTurn, turnSchema } from '$lib/server/ledger';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) =>
	json(await loadLedger(requireAccount(event).id));
export const POST: RequestHandler = async (event) => {
	requireSameOrigin(event);
	const user = requireAccount(event);
	const body = await event.request.text();
	if (body.length > 20000) error(413, 'This note is too long.');
	let value: unknown;
	try {
		value = JSON.parse(body);
	} catch {
		error(400, 'Invalid note.');
	}
	const parsed = turnSchema.safeParse(value);
	if (!parsed.success) error(400, 'A note, timestamp and revision are required.');
	return json(await saveTurn(user.id, parsed.data));
};
