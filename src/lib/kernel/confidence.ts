import type { EvidenceLink, HypothesisState } from './types';

export interface ConfidenceResult {
	supportScore: number;
	evidenceStrength: number;
	state: HypothesisState;
}

export function calculateConfidence(links: EvidenceLink[]): ConfidenceResult {
	const confirmed = links.filter((link) => link.status === 'confirmed');
	const support = confirmed
		.filter((link) => link.direction === 'supports')
		.reduce((sum, link) => sum + link.weight, 0);
	const contradiction = confirmed
		.filter((link) => link.direction === 'contradicts')
		.reduce((sum, link) => sum + link.weight, 0);
	const evidenceStrength = support + contradiction;
	const supportScore = (1 + support) / (2 + evidenceStrength);

	return {
		supportScore,
		evidenceStrength,
		state: classifyHypothesis(supportScore, evidenceStrength)
	};
}

function classifyHypothesis(score: number, strength: number): HypothesisState {
	if (strength < 1) return 'seed';
	if (strength >= 4 && score <= 0.25) return 'contradicted';
	if (strength >= 9 && score >= 0.8) return 'strong';
	if (strength >= 5 && score >= 0.7) return 'actionable';
	if (strength >= 3) return 'testable';
	return 'emerging';
}
