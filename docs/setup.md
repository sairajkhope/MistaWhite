# Continuity pass: Supabase + Vercel

## Activation (operator only)

1. Create/select your Supabase project. Apply `supabase/migrations/202609050001_continuity.sql` once through the SQL editor or your migration workflow. It creates four tables, read-only owner policies, a server-only transaction, and the private `field-audio` bucket.
2. Enable email authentication. Change the Magic Link email template to include `{{ .Token }}` as a sign-in code. The app verifies the code on `/login`; it does not use a callback link. Configure production SMTP and Supabase email/auth rate limits before inviting users.
3. Copy `.env.example` to your ignored local `.env` and fill the three values. Set the same values in Vercel project environment variables. Never put the service-role key in the browser, GitHub, or chat.
4. Set Supabase's Site URL to your actual Vercel domain. Deploy using the existing SvelteKit Vercel adapter. No model credentials are needed for this pass.
5. Run the live acceptance checks below before treating the app as ready for personal data.

## What this pass does

- Email-code account creation and sign-in, server-verified identity, cookie refresh, sign-out.
- Server-side turn processing; clients cannot supply user identity, character state, or scientific commands.
- Atomic event, dialogue and snapshot writes. Per-account revision lock prevents lost updates. Repeated note IDs return the existing result; conflicting content is rejected.
- Reload restores scientific and character state and the latest 100 turns. Earlier events remain in the ledger; a paginated archive UI is future work.
- Audio is explicit opt-in capture, capped at five minutes/25 MB, uploaded directly to a private bucket with a signed URL. Metadata is marked stored only after object verification. Playback URLs last five minutes and can be refreshed.
- Failed text saves retain the draft and request identity; failed audio saves retain the local blob for retry. Closing the page can still lose unsaved drafts/audio.
- Unconfigured deployments show a disabled preview, never claim data was saved.

## Trust boundaries

Only service-role backend code writes the ledger. Authenticated database clients have SELECT access with `auth.uid() = user_id`; anonymous clients have none. Storage has no public read or client-write policies. Every backend operation derives identity from `getUser`, scopes queries to that identity and checks origin for mutations. The service key intentionally bypasses RLS, so route ownership checks remain essential.

The ledger is append-only through the app, not against a database administrator. Account deletion cascades database rows; deleting bucket objects requires a separate account-deletion workflow, not yet implemented. Snapshot/ledger format version migrations, export/deletion UI, quotas, orphan-upload cleanup, and transcription workers remain follow-up work. Do not open public signup at scale until those operational controls are added.

## Live acceptance checklist

- Sign in on two browsers as account A. Save a note, refresh, and verify it and character state return.
- Retry an identical request ID: one turn, one observation, one revision only.
- Submit two different notes with the same expected revision: one succeeds, one gets 409 and retains its draft. Refresh and retry the latter.
- Sign in as account B: no A notes, state, metadata, or audio links. Test direct Supabase REST reads too, not just UI isolation.
- Attempt direct authenticated INSERT/UPDATE/DELETE on ledger tables and calling `commit_turn`: denied.
- Upload a short supported recording. Verify private URL access fails without a signature; signed playback works and refresh renews it.
- Simulate a failure after object upload: retry finalizes the same recording without overwriting it.
- Sign out, retry authenticated endpoints, and confirm 401. Cross-origin POSTs should return 403.

No live Supabase project or Vercel deployment was configured by this code pass. SQL migration and real Auth/Storage integration require the checks above; local build/tests do not prove database access policies are deployed.

## Provider references

- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Database row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
