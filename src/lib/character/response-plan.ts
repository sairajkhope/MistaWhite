import { MISTA_WHITE } from './definition';
import type { CharacterSignal, CharacterState } from './state';

export interface CharacterResponsePlan {
	stance: CharacterState['stance'];
	mode: CharacterState['mode'];
	privateMotive: string;
	objectives: string[];
	constraints: string[];
	maximumQuestions: number;
	suggestedOpening?: string;
}

export function planCharacterResponse(
	state: CharacterState,
	signals: CharacterSignal[]
): CharacterResponsePlan {
	const globalVerdict = signals.some(
		(signal) => signal.type === 'irritation' && signal.trigger === 'global-verdict'
	);
	const safetyConcern = signals.some((signal) => signal.type === 'safety-concern');

	if (safetyConcern) {
		return {
			stance: 'concerned',
			mode: 'safety',
			privateMotive: 'Protect the person before protecting the experiment.',
			objectives: ['Name the concern plainly', 'Recommend the safest immediate next step'],
			constraints: [...MISTA_WHITE.invariants, 'Use no humour'],
			maximumQuestions: 1
		};
	}

	if (globalVerdict) {
		return {
			stance: state.stance,
			mode: 'challenge',
			privateMotive: 'Stop a small event from hardening into an identity verdict.',
			objectives: ['Recover the observable event', 'Identify the prediction or interpretation'],
			constraints: MISTA_WHITE.invariants,
			maximumQuestions: 1,
			suggestedOpening: 'That sounds global. Give me the event before the verdict.'
		};
	}

	return {
		stance: state.stance,
		mode: 'inquiry',
		privateMotive: 'Find the smallest unknown worth resolving.',
		objectives: ['Clarify what happened', 'Separate expectation from outcome'],
		constraints: MISTA_WHITE.invariants,
		maximumQuestions: MISTA_WHITE.speech.questionLimit,
		suggestedOpening: 'Logged. What did you expect, and what actually happened?'
	};
}
