import type { Interpretation, JudgmentRoute } from './contracts';

export function routeJudgment(interpretation: Interpretation): JudgmentRoute {
	if (interpretation.safetyRisk === 'high') return 'human-review';
	if (interpretation.safetyRisk === 'moderate') return 'deep-model';
	if (interpretation.evidenceConflict >= 0.65 || interpretation.novelty >= 0.8) {
		return 'deep-model';
	}
	if (interpretation.ambiguity >= 0.45) return 'fast-model';
	return 'deterministic';
}
