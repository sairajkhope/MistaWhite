import type { CharacterMode, IrritationTrigger } from './definition';

export type CharacterStance =
	'attentive' | 'curious' | 'focused' | 'skeptical' | 'irritated' | 'concerned' | 'satisfied';

export type CharacterSignal =
	| { type: 'new-evidence' }
	| { type: 'experiment-completed' }
	| { type: 'user-correction' }
	| { type: 'safety-concern' }
	| { type: 'irritation'; trigger: IrritationTrigger; intensity?: number };

export interface CharacterState {
	revision: number;
	stance: CharacterStance;
	mode: CharacterMode;
	curiosity: number;
	concern: number;
	patience: number;
	irritation: Record<IrritationTrigger, number>;
	relationship: {
		familiarity: number;
		calibration: number;
		sharedExperiments: number;
	};
	unresolvedThreads: string[];
}

const emptyIrritation: Record<IrritationTrigger, number> = {
	'global-verdict': 0,
	'evidence-avoidance': 0,
	'performative-agreement': 0,
	'measurement-without-purpose': 0,
	'inference-presented-as-fact': 0
};

export function createInitialCharacterState(): CharacterState {
	return {
		revision: 0,
		stance: 'attentive',
		mode: 'companion',
		curiosity: 0.65,
		concern: 0,
		patience: 0.82,
		irritation: { ...emptyIrritation },
		relationship: { familiarity: 0, calibration: 0.5, sharedExperiments: 0 },
		unresolvedThreads: []
	};
}

export function evolveCharacter(state: CharacterState, signals: CharacterSignal[]): CharacterState {
	let next: CharacterState = {
		...state,
		revision: state.revision + 1,
		irritation: decayIrritation(state.irritation),
		relationship: {
			...state.relationship,
			familiarity: clamp(state.relationship.familiarity + 0.01)
		}
	};

	for (const signal of signals) {
		switch (signal.type) {
			case 'new-evidence':
				next = { ...next, stance: 'curious', curiosity: clamp(next.curiosity + 0.08) };
				break;
			case 'experiment-completed':
				next = {
					...next,
					stance: 'satisfied',
					relationship: {
						...next.relationship,
						sharedExperiments: next.relationship.sharedExperiments + 1
					}
				};
				break;
			case 'user-correction':
				next = {
					...next,
					stance: 'focused',
					relationship: {
						...next.relationship,
						calibration: clamp(next.relationship.calibration + 0.06)
					}
				};
				break;
			case 'safety-concern':
				next = {
					...next,
					stance: 'concerned',
					mode: 'safety',
					concern: clamp(next.concern + 0.4),
					irritation: { ...emptyIrritation }
				};
				break;
			case 'irritation': {
				const intensity = signal.intensity ?? 0.2;
				const irritation = {
					...next.irritation,
					[signal.trigger]: clamp(next.irritation[signal.trigger] + intensity)
				};
				next = {
					...next,
					irritation,
					stance: Math.max(...Object.values(irritation)) >= 0.45 ? 'irritated' : 'skeptical',
					mode: 'challenge',
					patience: clamp(next.patience - intensity * 0.15)
				};
				break;
			}
		}
	}

	return next;
}

function decayIrritation(
	irritation: Record<IrritationTrigger, number>
): Record<IrritationTrigger, number> {
	return Object.fromEntries(
		Object.entries(irritation).map(([key, value]) => [key, clamp(value - 0.025)])
	) as Record<IrritationTrigger, number>;
}

function clamp(value: number): number {
	return Math.min(1, Math.max(0, value));
}
