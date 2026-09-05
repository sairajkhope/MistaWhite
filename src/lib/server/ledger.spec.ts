import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalRuntime } from '$lib/agent/local-runtime';

const { from, rpc, tables } = vi.hoisted(() => ({
	from: vi.fn(),
	rpc: vi.fn(),
	tables: [] as { table: string; filters: [string, unknown][] }[]
}));
vi.mock('./access', () => ({ adminClient: () => ({ from, rpc }) }));
import { saveTurn, turnSchema } from './ledger';

const user = '550e8400-e29b-41d4-a716-446655440000';
const note = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	content: 'I took a walk.',
	occurredAt: '2026-09-05T10:00:00.000Z',
	expectedRevision: 0
};

function database(existing: unknown = null, revision = 0) {
	from.mockImplementation((table: string) => {
		const record = { table, filters: [] as [string, unknown][] };
		tables.push(record);
		const query = {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn((key: string, value: unknown) => {
				record.filters.push([key, value]);
				return query;
			}),
			lte: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue({ data: [], error: null }),
			maybeSingle: vi
				.fn()
				.mockResolvedValue({
					data:
						table === 'account_state' ? { revision, snapshot: createLocalRuntime(user) } : existing,
					error: null
				})
		};
		return query;
	});
	rpc.mockResolvedValue({ error: null, data: {} });
}

beforeEach(() => {
	vi.clearAllMocks();
	tables.length = 0;
});
describe('account ledger boundaries', () => {
	it('rejects client-supplied identity and state', () => {
		expect(turnSchema.safeParse({ ...note, userId: 'another-account' }).success).toBe(false);
		expect(turnSchema.safeParse({ ...note, snapshot: {} }).success).toBe(false);
	});
	it('writes generated state, events and reply in a single transaction scoped to verified identity', async () => {
		database();
		await saveTurn(user, note);
		expect(rpc).toHaveBeenCalledOnce();
		expect(rpc.mock.calls[0][0]).toBe('commit_turn');
		expect(rpc.mock.calls[0][1]).toMatchObject({
			p_user_id: user,
			p_expected_revision: 0,
			p_snapshot: { kernel: { userId: user, revision: 1 } }
		});
		expect(
			tables.every((record) =>
				record.filters.some(([key, value]) => key === 'user_id' && value === user)
			)
		).toBe(true);
	});
	it('does not regenerate a previously saved note on retry', async () => {
		database({
			input: { content: note.content, occurredAt: note.occurredAt },
			response: { text: 'Saved.' }
		});
		await saveTurn(user, note);
		expect(rpc).not.toHaveBeenCalled();
	});
	it('rejects reuse of a note ID with different content', async () => {
		database({ input: { content: 'Something else.', occurredAt: note.occurredAt } });
		await expect(saveTurn(user, note)).rejects.toMatchObject({ status: 409 });
		expect(rpc).not.toHaveBeenCalled();
	});
	it('rejects stale revisions without committing', async () => {
		database(null, 2);
		await expect(saveTurn(user, note)).rejects.toMatchObject({ status: 409 });
		expect(rpc).not.toHaveBeenCalled();
	});
	it('surfaces a transaction race as a retryable revision conflict', async () => {
		database();
		rpc.mockResolvedValue({ error: { message: 'REVISION_CONFLICT' } });
		await expect(saveTurn(user, note)).rejects.toMatchObject({ status: 409 });
	});
});
