import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { adminClient } from './access';
import { createLocalRuntime, runLocalTurn, type LocalRuntimeState } from '$lib/agent/local-runtime';
import type { JudgmentRoute } from '$lib/agent/contracts';

export const turnSchema = z
	.object({
		id: z.uuid(),
		content: z.string().trim().min(1).max(12000),
		occurredAt: z.iso.datetime(),
		expectedRevision: z.number().int().min(0)
	})
	.strict();

export interface SavedTurn {
	id: string;
	input: { content: string; occurredAt: string };
	response: { text: string; route: JudgmentRoute };
}

export async function loadLedger(userId: string) {
	const db = adminClient();
	const state = await db
		.from('account_state')
		.select('revision,snapshot')
		.eq('user_id', userId)
		.maybeSingle();
	const turns = await db
		.from('turns')
		.select('id,input,response')
		.eq('user_id', userId)
		.lte('revision', state.data?.revision ?? 0)
		.order('revision', { ascending: false })
		.limit(100);
	if (state.error || turns.error) error(503, 'Your notebook could not be loaded. Please retry.');
	return {
		revision: (state.data?.revision ?? 0) as number,
		runtime: (state.data?.snapshot ?? createLocalRuntime(userId)) as LocalRuntimeState,
		turns: (turns.data as SavedTurn[]).reverse()
	};
}

export async function saveTurn(userId: string, input: z.infer<typeof turnSchema>) {
	const db = adminClient();
	const payload = { content: input.content, occurredAt: input.occurredAt };
	const existing = await db
		.from('turns')
		.select('input,response')
		.eq('user_id', userId)
		.eq('id', input.id)
		.maybeSingle();
	if (existing.error)
		error(503, 'Could not check whether your note was saved. Retry this same note.');
	if (existing.data) {
		if (
			existing.data.input.content !== payload.content ||
			existing.data.input.occurredAt !== payload.occurredAt
		)
			error(409, 'This note ID was already used for different content.');
		return loadLedger(userId);
	}
	const current = await loadLedger(userId);
	if (current.revision !== input.expectedRevision)
		error(409, 'Your notebook changed in another tab. Refresh the notebook before retrying.');
	const result = runLocalTurn(current.runtime, {
		id: input.id,
		userId,
		channel: 'text',
		content: input.content,
		occurredAt: input.occurredAt,
		sourceId: `text:${input.id}`
	});
	const saved = await db.rpc('commit_turn', {
		p_user_id: userId,
		p_id: input.id,
		p_expected_revision: current.revision,
		p_input: payload,
		p_response: { text: result.displayText, route: result.judgmentRoute },
		p_snapshot: { kernel: result.kernelState, character: result.characterState },
		p_events: result.events
	});
	if (saved.error) {
		if (/REVISION_CONFLICT|IDEMPOTENCY_CONFLICT/.test(saved.error.message))
			error(409, 'Your notebook changed. Refresh before retrying this note.');
		error(503, 'Save could not be confirmed. Your draft is still here; retry the same note.');
	}
	return loadLedger(userId);
}
