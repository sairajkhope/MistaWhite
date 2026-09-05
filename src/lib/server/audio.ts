import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { adminClient } from './access';

export const audioSchema = z
	.object({
		id: z.uuid(),
		mime: z.enum(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']),
		size: z.number().int().positive().max(26214400),
		duration: z.number().int().min(0).max(300)
	})
	.strict();

export async function listAudio(userId: string) {
	const db = adminClient();
	const result = await db
		.from('recordings')
		.select('id,path,duration_seconds,status')
		.eq('user_id', userId)
		.eq('status', 'stored')
		.order('created_at', { ascending: false })
		.limit(30);
	if (result.error) error(503, 'Recordings could not be loaded.');
	return Promise.all(
		result.data.map(async (row) => {
			const signed = await db.storage.from('field-audio').createSignedUrl(row.path, 300);
			if (signed.error) error(503, 'Recording playback is temporarily unavailable.');
			return {
				id: row.id as string,
				duration: row.duration_seconds as number,
				url: signed.data.signedUrl
			};
		})
	);
}

export async function prepareAudio(userId: string, input: z.infer<typeof audioSchema>) {
	const db = adminClient();
	const path = `${userId}/${input.id}`;
	const existing = await db
		.from('recordings')
		.select('*')
		.eq('user_id', userId)
		.eq('id', input.id)
		.maybeSingle();
	if (existing.error) error(503, 'Could not prepare this recording.');
	if (
		existing.data &&
		(existing.data.byte_size !== input.size || existing.data.mime_type !== input.mime)
	)
		error(409, 'Recording ID already used.');
	if (!existing.data) {
		const inserted = await db.from('recordings').insert({
			user_id: userId,
			id: input.id,
			path,
			mime_type: input.mime,
			byte_size: input.size,
			duration_seconds: input.duration
		});
		if (inserted.error && inserted.error.code !== '23505')
			error(503, 'Could not prepare this recording.');
	}
	const uploaded = await db.storage.from('field-audio').info(path);
	if (!uploaded.error) return { alreadyUploaded: true, signedUrl: null };
	const signed = await db.storage
		.from('field-audio')
		.createSignedUploadUrl(path, { upsert: false });
	if (signed.error) error(503, 'Could not prepare a private upload.');
	return { alreadyUploaded: false, signedUrl: signed.data.signedUrl };
}

export async function completeAudio(userId: string, id: string) {
	const db = adminClient();
	const record = await db
		.from('recordings')
		.select('*')
		.eq('user_id', userId)
		.eq('id', id)
		.maybeSingle();
	if (record.error) error(503, 'Could not verify this recording.');
	if (!record.data) error(404, 'Recording not found.');
	const info = await db.storage.from('field-audio').info(record.data.path);
	if (info.error) error(409, 'Audio has not finished uploading. Retry the upload.');
	if (
		info.data.size !== record.data.byte_size ||
		info.data.contentType?.split(';')[0] !== record.data.mime_type
	)
		error(409, 'Uploaded audio does not match its declared size or format.');
	const saved = await db
		.from('recordings')
		.update({ status: 'stored' })
		.eq('user_id', userId)
		.eq('id', id);
	if (saved.error) error(503, 'Could not confirm this recording. Retry to finish saving.');
	return { saved: true };
}
