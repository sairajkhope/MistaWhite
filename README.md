# MistaWhite

Run life experiments cuz Science, Bitch!

MistaWhite is a character-first personal field scientist. Users bring voice, text, and eventually device observations; MistaWhite helps turn them into explicit hypotheses and consented experiments while keeping raw evidence separate from interpretation.

The model is not the character and it is not the source of truth. Character state and scientific state live in typed, testable systems so inference providers can be changed later.

## Current foundation

- SvelteKit web app configured for Vercel
- Working text interaction and browser voice capture prototype
- Event-driven scientific kernel with provenance and revision history
- Persistent character state with drives, modes, irritation, and behavioral invariants
- Judgment router for deterministic, fast, deep, and human-review paths
- Unit tests for permissions, provisional claims, safety, and character boundaries

## Run locally

```sh
npm install
npm run dev
```

Validation:

```sh
npm run check
npm test -- --run
npm run build
```

## Design documents

- [System architecture](docs/architecture.md)
- [Character bible](docs/character-bible.md)
- [Supabase activation and acceptance checks](docs/setup.md)

## Continuity pass

Email-code authentication, server-side text processing, atomic account ledger/snapshots,
retry-safe saves, and private audio uploads are now implemented. Configure Supabase
using the setup guide to activate them; without configuration the UI is a disabled preview.
No live Auth/Storage acceptance testing or deployment has been performed yet.
