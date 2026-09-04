import { calculateConfidence } from './confidence';
import type {
	ContextFact,
	DomainEvent,
	EvidenceLink,
	Experiment,
	Hypothesis,
	KernelCommand,
	KernelResult,
	KernelState,
	Observation,
	Trial
} from './types';

export function createInitialKernelState(userId: string): KernelState {
	return {
		userId,
		revision: 0,
		observations: [],
		contextFacts: [],
		hypotheses: [],
		evidenceLinks: [],
		experiments: []
	};
}

export class ScientistKernel {
	handle(state: KernelState, command: KernelCommand, now = new Date()): KernelResult {
		this.assertSameUser(state, command);
		const recordedAt = now.toISOString();
		const events = this.decide(state, command, recordedAt);
		return {
			state: events.reduce(reduceEvent, state),
			events
		};
	}

	private decide(state: KernelState, command: KernelCommand, recordedAt: string): DomainEvent[] {
		switch (command.type) {
			case 'observation.capture':
				assertNewId(state.observations, command.observation.id, 'Observation');
				return [
					event('observation.captured', command.actor, recordedAt, {
						...command.observation,
						capturedAt: recordedAt,
						status: command.actor.kind === 'user' ? 'confirmed' : 'proposed'
					})
				];
			case 'observation.correct': {
				assertUser(command.actor, 'Only the user can correct an observation.');
				assertExists(state.observations, command.observationId, 'Observation');
				assertNewId(state.observations, command.replacement.id, 'Replacement observation');
				return [
					event('observation.corrected', command.actor, recordedAt, {
						originalId: command.observationId,
						replacement: {
							...command.replacement,
							capturedAt: recordedAt,
							status: 'confirmed'
						}
					})
				];
			}
			case 'context.propose':
				assertNewId(state.contextFacts, command.fact.id, 'Context fact');
				return [
					event('context.proposed', command.actor, recordedAt, {
						...command.fact,
						createdAt: recordedAt,
						status: 'proposed'
					})
				];
			case 'context.confirm':
				assertUser(command.actor, 'Only the user can confirm personal context.');
				assertExists(state.contextFacts, command.factId, 'Context fact');
				return [
					event('context.confirmed', command.actor, recordedAt, {
						factId: command.factId,
						confirmedAt: recordedAt
					})
				];
			case 'hypothesis.create':
				assertNewId(state.hypotheses, command.hypothesis.id, 'Hypothesis');
				return [
					event('hypothesis.created', command.actor, recordedAt, {
						...command.hypothesis,
						status: command.actor.kind === 'user' ? 'confirmed' : 'proposed',
						state: 'seed',
						supportScore: 0.5,
						evidenceStrength: 0,
						createdAt: recordedAt
					})
				];
			case 'evidence.link':
				assertNewId(state.evidenceLinks, command.link.id, 'Evidence link');
				assertExists(state.observations, command.link.observationId, 'Observation');
				assertExists(state.hypotheses, command.link.hypothesisId, 'Hypothesis');
				if (command.link.weight <= 0 || command.link.weight > 3) {
					throw new KernelError('Evidence weight must be greater than 0 and at most 3.');
				}
				return [
					event('evidence.linked', command.actor, recordedAt, {
						...command.link,
						status: command.actor.kind === 'user' ? 'confirmed' : 'proposed',
						createdAt: recordedAt
					})
				];
			case 'evidence.confirm':
				assertUser(command.actor, 'Only the user can confirm an inferred evidence link.');
				assertExists(state.evidenceLinks, command.linkId, 'Evidence link');
				return [event('evidence.confirmed', command.actor, recordedAt, { linkId: command.linkId })];
			case 'experiment.draft':
				assertNewId(state.experiments, command.experiment.id, 'Experiment');
				assertExists(state.hypotheses, command.experiment.hypothesisId, 'Hypothesis');
				if (command.experiment.protocol.stopConditions.length === 0) {
					throw new KernelError('Every experiment requires at least one stop condition.');
				}
				return [
					event('experiment.drafted', command.actor, recordedAt, {
						...command.experiment,
						status: 'draft',
						createdAt: recordedAt,
						trials: []
					})
				];
			case 'experiment.approve': {
				assertUser(command.actor, 'Only the user can approve an experiment.');
				const experiment = assertExists(state.experiments, command.experimentId, 'Experiment');
				if (experiment.protocol.risk === 'high') {
					throw new KernelError('High-risk experiments require a separate safety review.');
				}
				return [
					event('experiment.approved', command.actor, recordedAt, {
						experimentId: command.experimentId,
						approvedAt: recordedAt
					})
				];
			}
			case 'experiment.start': {
				assertUser(command.actor, 'Only the user can start an experiment.');
				const experiment = assertExists(state.experiments, command.experimentId, 'Experiment');
				if (experiment.status !== 'approved') {
					throw new KernelError('An experiment must be approved before it can start.');
				}
				return [event('experiment.started', command.actor, recordedAt, command)];
			}
			case 'experiment.record-trial': {
				const experiment = assertExists(
					state.experiments,
					command.trial.experimentId,
					'Experiment'
				);
				if (experiment.status !== 'running') {
					throw new KernelError('Trials can only be recorded for a running experiment.');
				}
				assertNewId(experiment.trials, command.trial.id, 'Trial');
				return [event('experiment.trial-recorded', command.actor, recordedAt, command.trial)];
			}
		}
	}

	private assertSameUser(state: KernelState, command: KernelCommand): void {
		const owned =
			'observation' in command
				? command.observation.userId
				: 'replacement' in command
					? command.replacement.userId
					: 'fact' in command
						? command.fact.userId
						: 'hypothesis' in command
							? command.hypothesis.userId
							: 'experiment' in command
								? command.experiment.userId
								: state.userId;
		if (owned !== state.userId) throw new KernelError('Command belongs to a different account.');
	}
}

export class KernelError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'KernelError';
	}
}

function event<T>(type: string, actor: DomainEvent['actor'], recordedAt: string, payload: T) {
	return { id: crypto.randomUUID(), type, actor, recordedAt, payload } satisfies DomainEvent<T>;
}

function reduceEvent(state: KernelState, event: DomainEvent): KernelState {
	let next: KernelState = { ...state, revision: state.revision + 1 };
	switch (event.type) {
		case 'observation.captured':
			next = { ...next, observations: [...state.observations, event.payload as Observation] };
			break;
		case 'observation.corrected': {
			const payload = event.payload as { originalId: string; replacement: Observation };
			next = {
				...next,
				observations: [
					...state.observations.map((observation) =>
						observation.id === payload.originalId
							? { ...observation, status: 'superseded' as const }
							: observation
					),
					payload.replacement
				]
			};
			break;
		}
		case 'context.proposed':
			next = { ...next, contextFacts: [...state.contextFacts, event.payload as ContextFact] };
			break;
		case 'context.confirmed': {
			const payload = event.payload as { factId: string; confirmedAt: string };
			next = {
				...next,
				contextFacts: state.contextFacts.map((fact) =>
					fact.id === payload.factId
						? { ...fact, status: 'confirmed', lastConfirmedAt: payload.confirmedAt }
						: fact
				)
			};
			break;
		}
		case 'hypothesis.created':
			next = { ...next, hypotheses: [...state.hypotheses, event.payload as Hypothesis] };
			break;
		case 'evidence.linked':
			next = {
				...next,
				evidenceLinks: [...state.evidenceLinks, event.payload as EvidenceLink]
			};
			break;
		case 'evidence.confirmed': {
			const { linkId } = event.payload as { linkId: string };
			next = {
				...next,
				evidenceLinks: state.evidenceLinks.map((link) =>
					link.id === linkId ? { ...link, status: 'confirmed' } : link
				)
			};
			break;
		}
		case 'experiment.drafted':
			next = { ...next, experiments: [...state.experiments, event.payload as Experiment] };
			break;
		case 'experiment.approved': {
			const payload = event.payload as { experimentId: string; approvedAt: string };
			next = {
				...next,
				experiments: state.experiments.map((experiment) =>
					experiment.id === payload.experimentId
						? { ...experiment, status: 'approved', approvedAt: payload.approvedAt }
						: experiment
				)
			};
			break;
		}
		case 'experiment.started': {
			const { experimentId } = event.payload as { experimentId: string };
			next = {
				...next,
				experiments: state.experiments.map((experiment) =>
					experiment.id === experimentId ? { ...experiment, status: 'running' } : experiment
				)
			};
			break;
		}
		case 'experiment.trial-recorded': {
			const trial = event.payload as Trial;
			next = {
				...next,
				experiments: state.experiments.map((experiment) =>
					experiment.id === trial.experimentId
						? { ...experiment, trials: [...experiment.trials, trial] }
						: experiment
				)
			};
			break;
		}
	}

	if (event.type === 'evidence.linked' || event.type === 'evidence.confirmed') {
		next = recalculateHypotheses(next);
	}
	return next;
}

function recalculateHypotheses(state: KernelState): KernelState {
	return {
		...state,
		hypotheses: state.hypotheses.map((hypothesis) => {
			const result = calculateConfidence(
				state.evidenceLinks.filter((link) => link.hypothesisId === hypothesis.id)
			);
			return { ...hypothesis, ...result };
		})
	};
}

function assertUser(actor: DomainEvent['actor'], message: string): void {
	if (actor.kind !== 'user') throw new KernelError(message);
}

function assertExists<T extends { id: string }>(items: T[], id: string, label: string): T {
	const item = items.find((candidate) => candidate.id === id);
	if (!item) throw new KernelError(`${label} not found.`);
	return item;
}

function assertNewId<T extends { id: string }>(items: T[], id: string, label: string): void {
	if (items.some((item) => item.id === id)) throw new KernelError(`${label} ID already exists.`);
}

export function replayKernelEvents(userId: string, events: DomainEvent[]): KernelState {
	return events.reduce(reduceEvent, createInitialKernelState(userId));
}
