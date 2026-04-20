# PubSub Waste Measurement Findings

## Summary

The `sourceTrackingStatusBar` file watcher generated ~45K raw events during `npm install`, producing ~15-17 redundant `getStatus` calls to the org. Three fixes were applied incrementally:

1. **Callback-level debounce** — reduced Effect stream pushes from 45K to 20
2. **In-flight cancellation** — `{ switch: true }` interrupts stale `getStatus` calls when new signals arrive
3. **Scoped watchers + ForceIgnore filtering** — eliminates irrelevant callbacks entirely, reducing `getStatus` calls during `npm install` to 0

## Problem

The source tracking status bar used `vscode.workspace.createFileSystemWatcher('**/*')` — a glob that fires on every file event in the workspace. During `npm install`, this produces ~45K events. Each event was pushed into an Effect `Stream.async`, where `Stream.debounce(500ms)` discarded all but the last value per window. Each `emit.single()` call:

- Allocates a `Chunk`
- Resolves/enqueues a `Deferred`
- May schedule Effect fiber work

Every debounce window that fires triggers `refresh()` → `getStatus({ local: true, remote: true })`, which re-reads local tracking cache and makes a remote tracking check. During a 60-second `npm install`, this produced ~15-17 pointless status checks against the org.

## Measurement Results

**Test:** `rm -rf node_modules && npm install` with a scratch org (source-tracking enabled).

### Phase 1: Before (Stream.debounce only)

| Metric | Value |
|--------|-------|
| Raw callbacks | 41,446 |
| Stream pushes (`emit.single`) | 41,446 |
| Timer resets | N/A (no callback debounce) |
| Estimated `getStatus` calls | ~15-17 |

### Phase 2: After callback-level debounce

| Metric | Value |
|--------|-------|
| Raw callbacks | 44,939 |
| Stream pushes (`emit.single`) | **20** |
| Timer resets | 44,939 |
| Estimated `getStatus` calls | ~15-17 (unchanged — timer still resets per event) |

Stream push waste eliminated (2,247x reduction), but the debounce timer still resets on every raw callback, so every 500ms quiet window during the install still triggers a `getStatus`.

### Phase 3: After scoped watchers + ForceIgnore (final)

| Metric | Value |
|--------|-------|
| Raw callbacks reaching JS | ~0 (node_modules outside pkg dirs) or denied by ForceIgnore |
| Timer resets | **0** |
| Stream pushes | **0** |
| `getStatus` calls from file watcher | **0** |

Only the poll stream (every 60s) triggers `getStatus` during this period — which is the intended behavior for catching remote-only changes.

## Progression of Fixes

### Fix 1: Callback-level debounce

Moved debouncing from `Stream.debounce` into the raw callback using `clearTimeout`/`setTimeout`. The stream only receives a value when 500ms of quiet passes.

```typescript
// Before: every event pushes into the stream
const fire = () => { void emit.single(undefined); };

// After: only quiet periods push into the stream
let timer: ReturnType<typeof setTimeout> | undefined;
const fire = () => {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void emit.single(undefined); }, 500);
};
```

### Fix 2: In-flight cancellation

Replaced `Stream.runForEach(() => refresh(...))` with `Stream.flatMap(() => Stream.fromEffect(refresh(...)), { switch: true })`. When a new signal arrives while `refresh` is in-flight (e.g., waiting on a network call for remote tracking), Effect interrupts the running refresh and starts a fresh one.

### Fix 3: Scoped watchers + ForceIgnore

Two-layer filtering eliminates irrelevant events before they touch the debounce timer:

| Layer | What it eliminates | Mechanism |
|-------|-------------------|-----------|
| `RelativePattern` per package directory | Events from outside all package dirs (e.g., root-level `node_modules` when root is not a package dir) | OS-level file notification filtering, zero callback cost |
| `ForceIgnore.denies()` in callback | Events from ignored paths within package dirs (e.g., `force-app/node_modules/`, `**/__tests__/**`) | Regex match per event (~1μs), checked before timer reset |

Uses the same `.forceignore` file that `@salesforce/source-tracking` and `@salesforce/source-deploy-retrieve` already respect, ensuring the watcher's filter is consistent with what source tracking considers relevant.

Watchers automatically rebuild when `sfdx-project.json` or `.forceignore` changes.

## Other Watchers

The `aliasFileWatcher` and `configFileWatcher` are already well-scoped to specific files in `.sfdx`/`.sf` directories. No changes needed.
