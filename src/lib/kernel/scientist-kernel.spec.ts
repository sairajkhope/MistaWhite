import { describe, expect, it } from 'vitest';
import {
	createInitialKernelState,
	KernelError,
	replayKernelEvents,
	ScientistKernel
} from './scientist-kernel';

const user = { kind: 'user' as const, id: 'user-1' };
const scientist = { kind: 'scientist' as const, id: 'mista-white' };
const now = new Date('2026-09-04T00:00:00.000Z');

describe('ScientistKernel', () => {
	it('keeps machine-derived context provisional until the user confirms it', () => {
		const kernel = new ScientistKernel();
		const proposed = kernel.handle(
			createInitialKernelState('user-1'),
			{
				type: 'context.propose',
				actor: scientist,
				fact: {
					id: 'fact-1',
					userId: 'user-1',
					key: 'prefers_morning_experiments',
					value: true,
					sensitivity: 'ordinary',
					source: { id: 'source-1', type: 'voice' }
				}
			},
			now
		);

		expect(proposed.state.contextFacts[0]?.status).toBe('proposed');

		const confirmed = kernel.handle(
			proposed.state,
			{ type: 'context.confirm', actor: user, factId: 'fact-1' },
			now
		);
		expect(confirmed.state.contextFacts[0]?.status).toBe('confirmed');
	});

	it('preserves an original observation when the user corrects it', () => {
		const kernel = new ScientistKernel();
		const captured = kernel.handle(
			createInitialKernelState('user-1'),
			{
				type: 'observation.capture',
				actor: user,
				observation: {
					id: 'o-1',
					userId: 'user-1',
					kind: 'event',
					content: 'I slept six hours.',
					occurredAt: now.toISOString(),
					source: { id: 'note-1', type: 'text' }
				}
			},
			now
		);
		const corrected = kernel.handle(
			captured.state,
			{
				type: 'observation.correct',
				actor: user,
				observationId: 'o-1',
				replacement: {
					id: 'o-2',
					userId: 'user-1',
					kind: 'event',
					content: 'I slept seven hours.',
					occurredAt: now.toISOString(),
					source: { id: 'note-2', type: 'text' }
				}
			},
			now
		);

		expect(corrected.state.observations.map(({ status }) => status)).toEqual([
			'superseded',
			'confirmed'
		]);
		expect(replayKernelEvents('user-1', [...captured.events, ...corrected.events])).toEqual(
			corrected.state
		);
	});

	it('does not allow the scientist to approve an experiment', () => {
		const kernel = new ScientistKernel();
		let state = createInitialKernelState('user-1');
		state = kernel.handle(
			state,
			{
				type: 'hypothesis.create',
				actor: user,
				hypothesis: { id: 'h-1', userId: 'user-1', statement: 'A smaller step reduces avoidance.' }
			},
			now
		).state;
		state = kernel.handle(
			state,
			{
				type: 'experiment.draft',
				actor: scientist,
				experiment: {
					id: 'e-1',
					userId: 'user-1',
					hypothesisId: 'h-1',
					title: 'One smaller step',
					protocol: {
						prediction: 'Avoidance falls.',
						intervention: 'Reduce the action to two minutes.',
						primaryOutcome: 'Action started',
						minimumTrials: 3,
						stopConditions: ['Distress materially increases'],
						risk: 'low'
					}
				}
			},
			now
		).state;

		expect(() =>
			kernel.handle(
				state,
				{ type: 'experiment.approve', actor: scientist, experimentId: 'e-1' },
				now
			)
		).toThrow(KernelError);
	});

	it('requires approval before an experiment can start', () => {
		const kernel = new ScientistKernel();
		const state = createInitialKernelState('user-1');
		expect(() =>
			kernel.handle(state, { type: 'experiment.start', actor: user, experimentId: 'missing' }, now)
		).toThrow('Experiment not found.');
	});
});
