import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAccount, requireSameOrigin } from '$lib/server/access';
import { audioSchema, completeAudio, listAudio, prepareAudio } from '$lib/server/audio';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => json(await listAudio(requireAccount(event).id));
export const POST: RequestHandler = async (event) => {
	requireSameOrigin(event);
	const user = requireAccount(event);
	const raw = await event.request.text();
	if (raw.length > 2000) error(413, 'Request too large.');
	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		error(400, 'Invalid recording metadata.');
	}
	if (event.url.searchParams.get('action') === 'complete') {
		const parsed = z.object({ id: z.uuid() }).strict().safeParse(body);
		if (!parsed.success) error(400, 'Invalid recording ID.');
		return json(await completeAudio(user.id, parsed.data.id));
	}
	const parsed = audioSchema.safeParse(body);
	if (!parsed.success) error(400, 'Use an audio recording under 25 MB and five minutes.');
	return json(await prepareAudio(user.id, parsed.data));
};
