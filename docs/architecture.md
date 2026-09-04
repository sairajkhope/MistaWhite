# MistaWhite architecture

MistaWhite is character-first and model-last. The character creates continuity; the scientific kernel protects the truth. Models are replaceable workers behind those two systems.

## System layers

| Layer             | Owns                                                                | Must not own                           |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Raw ledger        | Voice, text, device data, timestamps, provenance                    | Interpretations or conclusions         |
| Scientific kernel | Context facts, hypotheses, evidence, experiment state, revisions    | Tone or model-specific prompts         |
| Character engine  | Drives, irritations, stance, relationship state, unresolved threads | Permission, safety, or evidence policy |
| Agent runtime     | Turn planning and judgment routing                                  | Permanent truth outside the ledger     |
| Adapters          | Supabase, OpenAI, queues, ESP32 ingestion                           | Domain rules                           |
| Product surface   | Capture, conversation, experiment review, consent                   | Secret provider settings               |

## Inputs, processing, outputs

| Stage      | Inputs                                                     | Processing                                                      | Outputs                                      |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Capture    | Voice, text, sensor records, corrections                   | Normalize format; retain source and original                    | Immutable observation event                  |
| Interpret  | Observation plus confirmed context                         | Extract candidates; label uncertainty; detect conflicts         | Provisional context and hypotheses           |
| Judge      | Candidates plus risk/ambiguity/novelty scores              | Route to rules, fast inference, deep inference, or human review | Validated kernel command                     |
| Experiment | Approved hypothesis, intervention, measure, stop condition | Collect evidence; compare against the stated prediction         | Experiment state and evidence links          |
| Respond    | Kernel events, character state, current mode               | Select motive, objective, limits, then render                   | Voice/text response and proposed next action |
| Revise     | User corrections and new evidence                          | Supersede claims without rewriting history                      | New revision with audit trail                |

## Non-negotiable invariants

1. Raw inputs are immutable. Corrections supersede; they do not silently rewrite history.
2. Model-derived context and hypotheses begin as provisional.
3. The user confirms personal context and evidence.
4. Only the user approves and starts an experiment.
5. Every experiment has a measure and stop condition. High-risk experiments require a separate safety path.
6. Pattern matching is never presented as causality.
7. Character irritation may alter directness, never evidence, permissions, dignity, or care.
8. A model response cannot directly mutate state. It must produce a typed proposal that is validated before becoming a kernel command.

## Character coherence

Coherence does not come from one persona prompt. It comes from:

- an immutable character definition;
- persistent emotional and relational state;
- unresolved threads carried across sessions;
- deterministic rules for how events move that state;
- response plans that state the character's private motive, objective, and constraints;
- regression evaluations that test whether different models still play the same character.

The rendered wording can change with the model. The motives, permissions, and behavioral boundaries cannot.

## Judgment routing

| Route          | Use it for                                           | Example                                 |
| -------------- | ---------------------------------------------------- | --------------------------------------- |
| Deterministic  | Permissions, state transitions, calculations         | Can this experiment start?              |
| Fast inference | Low-risk extraction and conversational rendering     | Turn a note into candidate observations |
| Deep inference | Conflicting evidence and multi-session synthesis     | Compare two plausible explanations      |
| Human review   | Safety, medical/legal stakes, or irreversible action | A potentially harmful intervention      |

## Next production adapters

1. Supabase Auth, Postgres event store, row-level security, and private audio buckets.
2. A Vercel-compatible asynchronous ingestion worker for transcription and extraction.
3. Server-only model gateways for OpenAI Realtime/voice and structured text inference.
4. Signed ESP32 uploads with device identity, checksums, resumable transfer, and idempotency keys.
5. Character and kernel evaluation suites before model selection is optimized.

The browser microphone does not require WASM when audio is sent to a backend model: `getUserMedia` and `MediaRecorder` are sufficient. WASM becomes useful only if transcription, denoising, or voice activity detection must run locally.
