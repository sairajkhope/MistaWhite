export type ISODateTime = string;
export type ActorKind = 'user' | 'scientist' | 'system';
export type RecordStatus = 'proposed' | 'confirmed' | 'disputed' | 'superseded';

export interface Actor {
	kind: ActorKind;
	id?: string;
}

export interface SourceRef {
	id: string;
	type: 'text' | 'voice' | 'device' | 'import' | 'system';
	uri?: string;
}

export type ObservationKind =
	| 'event'
	| 'sensation'
	| 'emotion'
	| 'action'
	| 'outcome'
	| 'prediction'
	| 'interpretation'
	| 'reflection';

export interface Observation {
	id: string;
	userId: string;
	kind: ObservationKind;
	content: string;
	occurredAt: ISODateTime;
	capturedAt: ISODateTime;
	status: RecordStatus;
	source: SourceRef;
}

export interface ContextFact {
	id: string;
	userId: string;
	key: string;
	value: unknown;
	status: RecordStatus;
	sensitivity: 'ordinary' | 'sensitive' | 'restricted';
	source: SourceRef;
	createdAt: ISODateTime;
	lastConfirmedAt?: ISODateTime;
}

export type HypothesisState =
	'seed' | 'emerging' | 'testable' | 'actionable' | 'strong' | 'contradicted';

export interface Hypothesis {
	id: string;
	userId: string;
	investigationId?: string;
	statement: string;
	status: RecordStatus;
	state: HypothesisState;
	supportScore: number;
	evidenceStrength: number;
	createdAt: ISODateTime;
}

export interface EvidenceLink {
	id: string;
	observationId: string;
	hypothesisId: string;
	direction: 'supports' | 'contradicts' | 'ambiguous';
	weight: number;
	status: RecordStatus;
	rationale?: string;
	createdAt: ISODateTime;
}

export type ExperimentStatus =
	'draft' | 'approved' | 'running' | 'paused' | 'completed' | 'analysed' | 'retired';

export interface ExperimentProtocol {
	prediction: string;
	intervention: string;
	primaryOutcome: string;
	minimumTrials: number;
	stopConditions: string[];
	risk: 'low' | 'moderate' | 'high';
}

export interface Trial {
	id: string;
	experimentId: string;
	occurredAt: ISODateTime;
	adherence: 'full' | 'partial' | 'none';
	result: string;
	confounders: string[];
}

export interface Experiment {
	id: string;
	userId: string;
	hypothesisId: string;
	title: string;
	status: ExperimentStatus;
	protocol: ExperimentProtocol;
	createdAt: ISODateTime;
	approvedAt?: ISODateTime;
	trials: Trial[];
}

export interface KernelState {
	userId: string;
	revision: number;
	observations: Observation[];
	contextFacts: ContextFact[];
	hypotheses: Hypothesis[];
	evidenceLinks: EvidenceLink[];
	experiments: Experiment[];
}

export interface DomainEvent<T = unknown> {
	id: string;
	type: string;
	actor: Actor;
	recordedAt: ISODateTime;
	payload: T;
}

export type KernelCommand =
	| {
			type: 'observation.capture';
			actor: Actor;
			observation: Omit<Observation, 'capturedAt' | 'status'>;
	  }
	| {
			type: 'observation.correct';
			actor: Actor;
			observationId: string;
			replacement: Omit<Observation, 'capturedAt' | 'status'>;
	  }
	| {
			type: 'context.propose';
			actor: Actor;
			fact: Omit<ContextFact, 'createdAt' | 'lastConfirmedAt' | 'status'>;
	  }
	| { type: 'context.confirm'; actor: Actor; factId: string }
	| {
			type: 'hypothesis.create';
			actor: Actor;
			hypothesis: Pick<Hypothesis, 'id' | 'userId' | 'investigationId' | 'statement'>;
	  }
	| {
			type: 'evidence.link';
			actor: Actor;
			link: Omit<EvidenceLink, 'createdAt' | 'status'>;
	  }
	| { type: 'evidence.confirm'; actor: Actor; linkId: string }
	| {
			type: 'experiment.draft';
			actor: Actor;
			experiment: Omit<Experiment, 'createdAt' | 'approvedAt' | 'status' | 'trials'>;
	  }
	| { type: 'experiment.approve'; actor: Actor; experimentId: string }
	| { type: 'experiment.start'; actor: Actor; experimentId: string }
	| {
			type: 'experiment.record-trial';
			actor: Actor;
			trial: Trial;
	  };

export interface KernelResult {
	state: KernelState;
	events: DomainEvent[];
}
