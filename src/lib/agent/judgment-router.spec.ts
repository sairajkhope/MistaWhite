import { describe, expect, it } from 'vitest';
import { routeJudgment } from './judgment-router';

describe('routeJudgment', () => {
	it('keeps ordinary processing deterministic', () => {
		expect(
			routeJudgment({
				observations: [],
				ambiguity: 0.1,
				novelty: 0.2,
				evidenceConflict: 0.1,
				safetyRisk: 'none'
			})
		).toBe('deterministic');
	});

	it('routes high-risk ambiguity to human review', () => {
		expect(
			routeJudgment({
				observations: [],
				ambiguity: 0.9,
				novelty: 0.9,
				evidenceConflict: 0.9,
				safetyRisk: 'high'
			})
		).toBe('human-review');
	});
});
