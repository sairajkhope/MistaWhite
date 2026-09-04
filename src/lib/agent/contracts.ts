import type { CharacterResponsePlan } from '../character/response-plan';
import type { CharacterState } from '../character/state';
import type { DomainEvent, KernelState, ObservationKind } from '../kernel/types';

export interface TurnInput {
	id: string;
	userId: string;
	channel: 'text' | 'voice';
	content: string;
	occurredAt: string;
	sourceId: string;
}

export interface ObservationCandidate {
	kind: ObservationKind;
	content: string;
	confidence: number;
}

export interface Interpretation {
	observations: ObservationCandidate[];
	ambiguity: number;
	novelty: number;
	evidenceConflict: number;
	safetyRisk: 'none' | 'low' | 'moderate' | 'high';
}

export type JudgmentRoute = 'deterministic' | 'fast-model' | 'deep-model' | 'human-review';

export interface AgentTurnResult {
	kernelState: KernelState;
	characterState: CharacterState;
	events: DomainEvent[];
	judgmentRoute: JudgmentRoute;
	responsePlan: CharacterResponsePlan;
	displayText: string;
}

export interface EventStore {
	load(userId: string): Promise<{ kernel: KernelState; character: CharacterState }>;
	append(userId: string, events: DomainEvent[]): Promise<void>;
}

export interface ModelGateway {
	generateStructured<T>(request: {
		purpose: string;
		input: unknown;
		responseSchema: string;
	}): Promise<{ value: T; modelRef: string }>;
}
