# Device-state atomic write contract

**CAS writers are wired into the application code, but fail closed unless
`DEVICE_STATE_WRITE_MODE=cas` is explicitly enabled. No live Supabase calls
were made while preparing or testing this integration.**

## Existing contract observed

The active repository reads `chat_id`, `state`, `last_action`, `updated_at`,
and `revision`. CAS updates use the configured RPC and never fall back to
full-state upsert. Initial state creation uses insert-only semantics at
revision zero; a duplicate-key race rereads the winning row.

Writers include the cron, HTTP action route and action service, Telegram
callbacks, and telemetry ingestion. `GET /api/state/:chatId` reads the row and
can create it through `ensureDeviceState()`. The frontend writes through the
HTTP action endpoint rather than directly to Supabase.

## Experimental API

`applyDeviceStateIntent(repository, chatId, intent, { maxAttempts })` expects an
injected repository with:

- `read(chatId) -> { chatId, state, revision, lastAction, updatedAt }`
- `compareAndSwap({ chatId, expectedRevision, nextState, lastAction })`
  returning `{ status: "updated", snapshot }` or `{ status: "conflict" }`

The intent is a replayable transformation of a fresh state snapshot. On a
conflict it is rerun against a newly read snapshot; it must not retain and
resubmit a stale JSON document. Repository read/write failures and exhausted
conflicts reject explicitly.

The in-memory test repository models a compare-and-swap boundary only. Its
passing tests do not prove PostgreSQL atomicity, RLS behavior, or Supabase RPC
permissions.

The separate `supabaseDeviceStateRepository.js` adapter implements this
repository interface using an explicitly injected Supabase client. It reads
`revision`, provides insert-only creation, and calls the named RPC; it does not
create a client or load secrets. `deviceStates.js` and all active writers now
use this adapter only after `DEVICE_STATE_WRITE_MODE=cas` is explicitly set.
With the confirmed `BIGINT` key, it canonicalizes IDs to decimal strings and rejects unsafe
JavaScript numeric IDs. The RPC response omits `chat_id`, avoiding a lossy
BIGINT-to-JavaScript-Number round trip; the adapter retains the exact ID used
for the request.

## Proposed database invariant

For each `chat_id`, a successful update must atomically:

1. Match the caller's expected `revision`.
2. Replace `state` with the newly transformed state.
3. Update `last_action` if provided.
4. Increment `revision` exactly once.
5. Return the committed snapshot.

A stale revision returns a conflict without changing any columns. A missing
row and database error must be distinguishable from a conflict.

The checked-in SQL file is a review-only draft for the reported `BIGINT`
`chat_id` schema and is not executed by the application. The target database
must provide the matching `update_device_state_if_revision` RPC and `revision`
column before enabling the feature.

All application writer paths now use replayable CAS intents: cron,
`executeAction`, action HTTP settings, Telegram scale/action callbacks,
telemetry, and insert-only state creation. The frontend continues to write
through the action HTTP endpoint. Any older deployed application instance or
external writer that still performs a full-state update can overwrite a newer
document. Enable `DEVICE_STATE_WRITE_MODE=cas` only after all old instances
are drained and every external writer is confirmed migrated. When unset,
writes fail explicitly instead of falling back to an unsafe upsert. Creating a
missing row additionally requires the service role's INSERT privilege and an
applicable RLS policy; previously confirmed SELECT/UPDATE grants are not
sufficient evidence for this permission.

## Side effects

Retryable state transformations do not perform network/database side effects.
Cron and telemetry dispatch events, Telegram notifications, and measurements
only after CAS succeeds. This prevents effects from rejected retries, but does
not provide exactly-once delivery: process failure after state commit or
ambiguous network responses can lose or duplicate effects. Cron claims its
measurement timestamp in the committed state before insertion; a failed
measurement insert can lose that interval's snapshot. A
transactional outbox with stable idempotency keys is still needed for reliable
delivery.

Telemetry needs a stable source sample identifier to deduplicate history
inserts. The repository currently shows no such identifier. Cron effects need
a stable run/tick identity. Neither should be synthesized from a close
timestamp alone.

## Safe adoption gate

Do not mix new CAS writers with legacy full-state upserts. First deploy the
atomic DB contract and compatible code to every writer, or quiesce writes for a
coordinated cutover. Only then enforce the new protocol. A database trigger
could reject legacy updates but would cause failures from older application
instances; it is not a zero-downtime substitute without a coordinated rollout.

Before enabling CAS, an operator must confirm:

- `public.device_states` exists and the exact types, nullability, and defaults
  of `chat_id`, `state`, `last_action`, and `updated_at`;
- `chat_id` has a single-column primary/unique constraint;
- whether the existing UPDATE trigger maintains `updated_at`;
- RLS enablement, INSERT/SELECT/UPDATE grants and policies, and the exact
  database role used by the backend service key;
- Supabase RPC schema-cache refresh behavior after adding the function;
- deployed application versions and all active writer locations.

The SQL draft uses `SECURITY INVOKER`; the backend role must have the table
privileges required by the RPC and satisfy RLS. Confirm and grant only the
needed function execute permission to the backend role. Do not expose the RPC
to untrusted client roles and do not switch to `SECURITY DEFINER` as a shortcut.
The draft intentionally leaves grants to be written after the actual role and
policy are confirmed.

Suggested cutover order: confirm the migration/RPC in the target environment
and schema cache; confirm permissions including INSERT; schedule a write
maintenance window or otherwise guarantee all old instances are drained;
deploy this coordinated backend build with the flag unset; verify every writer
against a development project; set `DEVICE_STATE_WRITE_MODE=cas` for all
instances together; verify each writer; then resume normal writes. Do not
enable CAS for only a subset of instances or while legacy writers remain.

## Virtual calendar compatibility

The future `virtualInstantMs` is an optional canonical property inside `state`.
An absent value remains absent for legacy rows until explicit initialization.
Do not infer it from `horaVirtual`, `updated_at`, process start, or sowing data.
Keep `horaVirtual`, `usarHoraReal`, `timeScale`, and `__lastCronMs`; the hour
must be a projection once the calendar is initialized. The active cron does
not yet use this module or the canonical instant.

Neither CAS nor the current adapter deduplicates cron ticks or external effects.
Stable tick/sample identifiers and an outbox/idempotency strategy remain
separate approval gates.
