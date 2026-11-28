# Use Effect schedules for Apex test progress

- W-23059347: Apex streaming inventory after W-23051181 monorepo migration.
- Asynchronous tests: Tooling API polling; no maintained CometD client or streaming-to-polling fallback.
- Both APIs: shared status query, response decoder (including missing/malformed summaries), and terminal-status predicate in [`testRunProgress.ts`](../../src/effect/testRunProgress.ts).
- Effect-owned repetition, delays, deadlines, interruption; no new polling client abstraction.

## Inventory and ownership

| Implementation | Consumer and decision |
| --- | --- |
| Apex's former `src/streaming/streamingClient` and `StreamingErrors` | Already removed. Remove unused direct `faye` dependency and `ApexFayeClient` declaration. `src/streaming/testResultStringify.ts`: result-file serialization, not networking. |
| Apex Promise test API (`src/tests/asyncTests.ts`) | `Effect.repeat`, `Schedule`, `Effect.timeoutOption`; unchanged Promise signatures, kit durations, cancellation tokens, 1-second default interval, 4-hour default timeout. Submission wait timeout: return run ID; no remote abort. |
| Apex Effect test API (`src/effect/asyncTests.ts`) | `Stream.repeatEffectWithSchedule`; unchanged 2-second default interval, caller-owned deadlines. Submission scope closure: abort unfinished queue items. |
| Apex log polling (`src/effect/logs.ts`) | Keep `streamLogs`, caller-supplied schedules. Consumer: VS Code log collection. No custom network streaming client. |
| Core `StreamingClient` (`@salesforce/core` 9.6.0) | Canonical client for `LogService.tail`, `/systemTopic/Logging`; ownership: handshake, subscription timeout, replay, Faye implementation. Core's transitive Faye dependency unchanged. |
| Interactive debugger (`packages/salesforcedx-apex-debugger/src/core/streamingClient.ts`) | Unchanged separate Faye consumer: debugger channels, explicit proxy credentials, replay IDs, transport callbacks, explicit disconnect. Debugger protocol replacement outside Apex test-streaming scope. |

## Published API boundary

- [ADR 0005](./0005-effect-api-and-host-boundaries.md): Effect: CLI library runtime dependency. Root: Promise API. `./effect`: typed Effects/Streams. No VS Code service/runtime; no new public exports.
- Keep `ApexTestQueueItemStatus`: Tooling records for result retrieval/cancellation, not transport.
- Keep legacy `StreamingClientProgress` union members/schema entries: contract compatibility; no emissions from either test API.
