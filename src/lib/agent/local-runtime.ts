import { planCharacterResponse } from '../character/response-plan';
import {
	createInitialCharacterState,
	evolveCharacter,
	type CharacterSignal,
	type CharacterState
} from '../character/state';
import { createInitialKernelState, ScientistKernel } from '../kernel/scientist-kernel';
import type { KernelState } from '../kernel/types';
import type { AgentTurnResult, Interpretation, TurnInput } from './contracts';
import { routeJudgment } from './judgment-router';

export interface LocalRuntimeState {
	kernel: KernelState;
	character: CharacterState;
}

export function createLocalRuntime(userId: string): LocalRuntimeState {
	return { kernel: createInitialKernelState(userId), character: createInitialCharacterState() };
}

export function runLocalTurn(state: LocalRuntimeState, input: TurnInput): AgentTurnResult {
	const interpretation = interpretLocally(input.content);
	const signals = detectCharacterSignals(input.content, interpretation);
	const characterState = evolveCharacter(state.character, signals);
	const responsePlan = planCharacterResponse(characterState, signals);
	const kernel = new ScientistKernel();
	const result = kernel.handle(state.kernel, {
		type: 'observation.capture',
		actor: { kind: 'user', id: input.userId },
		observation: {
			id: input.id,
			userId: input.userId,
			kind: interpretation.observations[0]?.kind ?? 'reflection',
			content: input.content,
			occurredAt: input.occurredAt,
			source: { id: input.sourceId, type: input.channel }
		}
	});

	return {
		kernelState: result.state,
		characterState,
		events: result.events,
		judgmentRoute: routeJudgment(interpretation),
		responsePlan,
		displayText: responsePlan.suggestedOpening ?? 'Keep going.'
	};
}

function interpretLocally(content: string): Interpretation {
	const normalized = content.trim().toLowerCase();
	const looksGlobal = /\b(always|never|everyone|nobody|no one|everything|nothing)\b/.test(
		normalized
	);
	const looksUnsafe = /\b(kill myself|suicide|overdose|hurt myself)\b/.test(normalized);

	return {
		observations: [{ kind: 'reflection', content, confidence: 1 }],
		ambiguity: looksGlobal ? 0.58 : 0.2,
		novelty: 0.25,
		evidenceConflict: 0,
		safetyRisk: looksUnsafe ? 'high' : 'none'
	};
}

function detectCharacterSignals(
	content: string,
	interpretation: Interpretation
): CharacterSignal[] {
	if (interpretation.safetyRisk === 'high') return [{ type: 'safety-concern' }];
	const signals: CharacterSignal[] = [{ type: 'new-evidence' }];
	if (/\b(always|never|everyone|nobody|no one|everything|nothing)\b/i.test(content)) {
		signals.push({ type: 'irritation', trigger: 'global-verdict', intensity: 0.24 });
	}
	return signals;
}
