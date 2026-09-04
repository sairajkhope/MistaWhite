import { describe, expect, it } from 'vitest';
import { parseCharacterRender, parseInterpretation } from './schemas';

describe('model boundaries', () => {
	it('accepts bounded structured interpretations', () => {
		const result = parseInterpretation({
			observations: [{ kind: 'event', content: 'I woke at 07:10.', confidence: 0.95 }],
			ambiguity: 0.1,
			novelty: 0.2,
			evidenceConflict: 0,
			safetyRisk: 'none'
		});

		expect(result.observations[0].kind).toBe('event');
	});

	it('rejects state mutation hidden in rendered dialogue', () => {
		expect(() =>
			parseCharacterRender({
				text: 'Logged.',
				kernelCommand: { type: 'experiment.start', experimentId: 'exp-1' }
			})
		).toThrow();
	});
});
