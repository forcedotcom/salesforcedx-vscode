# PubSub runtime measurement (Extension Host)

Companion to [pubsub-waste-findings.md](pubsub-waste-findings.md): that doc describes the problem and fix phases; this doc records **hypotheses**, **how logs are produced**, and **sample log lines** from real Extension Host runs with temporary `[sf pubsub]` instrumentation.

## When and where logs appear

Instrumentation uses **`console.log`**, batched on a **5 second wall-clock throttle** per subsystem. Lines appear in the **Extension Host** output (Debug Console for the extension host launch, or Developer Tools console for the extension host process).

**Prefix:** `[sf pubsub]` — filter the console on this string.

**Why 5 seconds:** File churn (e.g. `npm install`) can emit tens of thousands of events; logging every event would overwhelm the host. Each counter is **cumulative** for the session; each printed line is a **snapshot** of those counters at the last throttle boundary (roughly every 5s after the first bump in that subsystem).

**Interleaved lines:** `fileWatcher`, `sourceTrackingStatusBar`, and `getStatus` throttle **independently** (`lastLogMs` per block). Snapshots taken a few milliseconds apart can show slightly different totals for the same underlying burst (e.g. `fileWatcher` vs `statusBarPubSubInboundPreDebounce`).

**Artifact — `getStatusLocalAndRemote` vs `trackingGetStatusInvoked`:** Entry to `SourceTrackingService.getStatus` is counted **before** semaphores; STL `tracking.getStatus(...)` is counted **immediately before** the `tryPromise` that calls it (after `take` and rereads). A single 5s window can print **once** after service entry and **again** after STL runs, so you may briefly see `(1, 0)` then `(1, 1)` for one logical call — not a skipped STL invocation.

### STL boundary lines (`[sf pubsub] STL`)

The STL package **`@salesforce/source-tracking`** is not edited in this repo. Instrumentation sits in **`SourceTrackingService.getStatus`** immediately **before and after** each call into STL:

| Immediate log | Meaning |
|-----------------|--------|
| `[sf pubsub] STL reReadLocalTrackingCache start` then `… done` | `tracking.reReadLocalTrackingCache()` entered and returned (same JS turn / async completion as STL). |
| `[sf pubsub] STL reReadRemoteTracking start` then `… done` | `tracking.reReadRemoteTracking()` — **remote tracking refresh**; correlate `t` with concurrent `[sf pubsub] fileWatcher` / `sourceTrackingStatusBar` lines to see if remote re-read runs **while** inbound file counters are still climbing. |
| `[sf pubsub] STL tracking.getStatus start` then `… done` | STL `tracking.getStatus({ local, remote })` promise. |

These lines are **not 5s-throttled** (STL calls are low volume per run). The batched `[sf pubsub] getStatus` object also includes cumulative **`stlReReadLocalGetStatusStart` / `Done`** and **`stlReReadRemoteGetStatusStart` / `Done`** for the `getStatus` path only.

**Org traffic:** Remote re-read **may** hit the network depending on STL internals; these logs prove **when** that API ran, not HTTP status. Use spans or a proxy if you need wire-level proof.

## Instrumentation (sources of each field)

| Log tag | File | What increments | When it logs |
|---------|------|-----------------|--------------|
| `fileWatcher` | [packages/salesforcedx-vscode-services/src/vscode/fileWatcherService.ts](../packages/salesforcedx-vscode-services/src/vscode/fileWatcherService.ts) | `workspaceFileEventsToPubSub`: each row processed from the `**/*` watcher stream before `PubSub.publish`. `pubSubPublishOk` / `pubSubPublishFail`: publish success or failure. | Throttled `pubsubWasteFwLog()` after any bump. |
| `sourceTrackingStatusBar` | [packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts](../packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts) | `statusBarPubSubInboundPreDebounce`: each element from `FileChangePubSub` **before** first `Stream.debounce(500)` on the file branch. `statusBarAfterFirstFileDebounce`: each element **after** that debounce. `statusBarRefresh`: start of `statusBarRefresh` (before `hasTracking` / `getStatus`). | Same 5s throttle. |
| `getStatus` | [packages/salesforcedx-vscode-services/src/core/sourceTrackingService.ts](../packages/salesforcedx-vscode-services/src/core/sourceTrackingService.ts) | `getStatusLocalAndRemote` / `getStatusOtherShape`: service entry. `trackingGetStatusInvoked`: before STL `tracking.getStatus`. `stlReReadLocalGetStatusStart/Done`, `stlReReadRemoteGetStatusStart/Done`: boundary counts for `getStatus` rereads only. | Same 5s throttle. |
| `STL` | Same file, inside `getStatus` only | Per-call **`[sf pubsub] STL`** immediate lines around `reReadLocalTrackingCache`, `reReadRemoteTracking`, `tracking.getStatus`. | Every STL boundary (no 5s throttle). |

**Reproduce:** Launch Extension Host with services + metadata; open a source-tracked project with a default org; run heavy FS churn (`rm -rf node_modules && npm install`). Remove `#region agent log` blocks when finished measuring.

## Hypotheses and how logs test them

| ID | Hypothesis | How to read the logs | Typical outcome (develop / pre–scoped-watcher) |
|----|------------|----------------------|------------------------------------------------|
| H-raw | Workspace `**/*` watcher produces very high event volume. | `workspaceFileEventsToPubSub` and `statusBarPubSubInboundPreDebounce` grow into the tens of thousands during install. | **Supported** — see samples below. |
| H-debounce | `Stream.debounce(500)` on the file branch collapses almost all inbound events into a small number of downstream emissions. | Compare `statusBarPubSubInboundPreDebounce` to `statusBarAfterFirstFileDebounce`. | **Supported** — O(10⁴) vs O(1–10). |
| H-org | `getStatus({ local, remote })` count is not proportional to raw file events. | Compare `getStatusLocalAndRemote` to inbound counters. | **Supported** — single digits vs 10⁴+ inbound. |
| H-STL | Each completed `getStatus` invocation reaches `tracking.getStatus` once. | After logs align, `trackingGetStatusInvoked` equals `getStatusLocalAndRemote` for the same cumulative state. | **Supported**; brief `(n, n-1)` is throttle/snapshot timing. |
| H-publish-fail | Sliding `PubSub` can fail under pressure (`publishFail`). | `pubSubPublishFail` stays 0. | **Supported** in samples (no failures observed). |
| H-refresh-skip | Not every `statusBarRefresh` calls `getStatus` (e.g. `!hasTracking`). | `statusBarRefresh` can exceed `getStatusLocalAndRemote`. | **Supported** when early return happens. |
| H-off-by-one-watcher | `workspaceFileEventsToPubSub` vs `pubSubPublishOk` differ by one at snapshot. | Often `Ok = workspace - 1` at a log line. | **Inconclusive** — snapshot between increment and completed publish, not evidence of loss if `publishFail` is 0. |
| H-remote-reread-during-churn | STL `reReadRemoteTracking` runs more than once while workspace file counters are still large or rising. | Interleave `[sf pubsub] STL reReadRemoteTracking start|done` `{t:…}` with batched `fileWatcher` / `sourceTrackingStatusBar` lines showing multi-thousand cumulative counts. | **Supported** — see log record C. |
| H-org-http | Each `reReadRemoteTracking` implies a separate Salesforce / org HTTP round-trip. | Logs show STL boundary only, not transport. | **Not provable here** — need spans, proxy, or STL source. |

## Log record A (heavy churn; `[sf pubsub]` prefix)

Captured during workspace file churn (e.g. `npm install`). Shows torrent → debounce → low `getStatus` / STL counts.

```
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 0, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 1}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 1, pubSubPublishOk: 0, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 1, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 1}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 4984, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 1}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 5260, pubSubPublishOk: 5259, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 15260, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 1}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 15760, pubSubPublishOk: 15759, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 25364, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 1}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 26260, pubSubPublishOk: 26259, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 35262, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 1}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 37260, pubSubPublishOk: 37259, pubSubPublishFail: 0}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 1, getStatusOtherShape: 0, trackingGetStatusInvoked: 0}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 1, getStatusOtherShape: 0, trackingGetStatusInvoked: 1}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 42003, statusBarAfterFirstFileDebounce: 2, statusBarRefresh: 3}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 2, getStatusOtherShape: 0, trackingGetStatusInvoked: 2}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 42003, statusBarAfterFirstFileDebounce: 2, statusBarRefresh: 4}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 3, getStatusOtherShape: 0, trackingGetStatusInvoked: 3}
```

**Reading A:** Inbound file events reach **~42k** while `statusBarAfterFirstFileDebounce` stays **2** (first debounce on the file branch). `getStatusLocalAndRemote` and `trackingGetStatusInvoked` align at **2** and **3** once stable; the pair of `getStatus` lines with `(1,0)` then `(1,1)` illustrates the **throttle snapshot artifact** on a single in-flight invocation. `statusBarRefresh: 4` vs `getStatusLocalAndRemote: 3` illustrates **H-refresh-skip** (one refresh did not reach `getStatus`).

## Log record B (alternate run; longer tail)

Another install-scale run (slightly different timing). Same interpretation.

```
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 0, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 1}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 0, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 2}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 1, getStatusOtherShape: 0}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 1, pubSubPublishOk: 0, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 1, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 2}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 6259, pubSubPublishOk: 6258, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 6259, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 2}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 16259, pubSubPublishOk: 16258, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 16259, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 2}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 26536, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 2}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 26759, pubSubPublishOk: 26758, pubSubPublishFail: 0}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 2, getStatusOtherShape: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 37657, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 3}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 38259, pubSubPublishOk: 38258, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 43109, statusBarAfterFirstFileDebounce: 2, statusBarRefresh: 4}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 3, getStatusOtherShape: 0}
```

**Note:** Record B predates the `trackingGetStatusInvoked` field; those `getStatus` lines only show service entry counts.

## Log record C (latest run — STL boundary + heavy churn)

Same workload class (Extension Host, source-tracked project, heavy workspace changes). Includes **`[sf pubsub] STL …`** immediate lines and full **`getStatus`** batched fields (`trackingGetStatusInvoked`, `stlReRead*GetStatusStart`, etc.). Truncated object fields in the capture appear as `…`.

```
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 0, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 1}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 0, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 2}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 1, getStatusOtherShape: 0, trackingGetStatusInvoked: 0, stlReReadLocalGetStatusStart: 0, …}
[sf pubsub] STL reReadLocalTrackingCache start {t: 1776960363121}
[sf pubsub] STL reReadRemoteTracking start {t: 1776960363122}
[sf pubsub] STL reReadLocalTrackingCache done {t: 1776960363238}
[sf pubsub] STL reReadRemoteTracking done {t: 1776960363588}
[sf pubsub] STL tracking.getStatus start {t: 1776960363588}
[sf pubsub] STL tracking.getStatus done {t: 1776960363965}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 1, pubSubPublishOk: 0, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 1, statusBarAfterFirstFileDebounce: 0, statusBarRefresh: 2}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 2, getStatusOtherShape: 0, trackingGetStatusInvoked: 1, stlReReadLocalGetStatusStart: 1, …}
[sf pubsub] STL reReadLocalTrackingCache start {t: 1776960371959}
[sf pubsub] STL reReadRemoteTracking start {t: 1776960371960}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 8269, pubSubPublishOk: 8268, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 7934, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 3}
[sf pubsub] STL reReadRemoteTracking done {t: 1776960377442}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 2, getStatusOtherShape: 0, trackingGetStatusInvoked: 1, stlReReadLocalGetStatusStart: 2, …}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 18696, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 3}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 18932, pubSubPublishOk: 18931, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 28932, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 3}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 29432, pubSubPublishOk: 29431, pubSubPublishFail: 0}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 39432, statusBarAfterFirstFileDebounce: 1, statusBarRefresh: 3}
[sf pubsub] fileWatcher {hypothesisId: 'H-aggregate', workspaceFileEventsToPubSub: 39590, pubSubPublishOk: 39589, pubSubPublishFail: 0}
[sf pubsub] STL reReadLocalTrackingCache done {t: 1776960395421}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 2, getStatusOtherShape: 0, trackingGetStatusInvoked: 1, stlReReadLocalGetStatusStart: 2, …}
[sf pubsub] STL tracking.getStatus start {t: 1776960395422}
[sf pubsub] STL tracking.getStatus done {t: 1776960395437}
[sf pubsub] sourceTrackingStatusBar {hypothesisId: 'H-aggregate', statusBarPubSubInboundPreDebounce: 43276, statusBarAfterFirstFileDebounce: 2, statusBarRefresh: 4}
[sf pubsub] STL reReadLocalTrackingCache start {t: 1776960395940}
[sf pubsub] STL reReadRemoteTracking start {t: 1776960395940}
[sf pubsub] STL reReadRemoteTracking done {t: 1776960400628}
[sf pubsub] getStatus {hypothesisId: 'H-aggregate', getStatusLocalAndRemote: 3, getStatusOtherShape: 0, trackingGetStatusInvoked: 2, stlReReadLocalGetStatusStart: 3, …}
[sf pubsub] STL reReadLocalTrackingCache done {t: 1776960400714}
[sf pubsub] STL tracking.getStatus start {t: 1776960400714}
[sf pubsub] STL tracking.getStatus done {t: 1776960400727}
```

**Reading C**

- **First full `getStatus`:** Local + remote reread and `tracking.getStatus` complete in order (`t` 1776960363121 → 1776960363965).
- **Second invocation (overlapping wall-clock):** `reReadRemoteTracking` **start** `1776960371960` while batched counters already show **thousands** of file events (`workspaceFileEventsToPubSub: 8269`, `statusBarPubSubInboundPreDebounce: 7934` on adjacent lines); **done** `1776960377442` (~5.5s). Batched `getStatus` lines with `getStatusLocalAndRemote: 2` and `trackingGetStatusInvoked: 1` reflect **two service entries** while the **inner** `tracking.getStatus` counter has not yet caught up for the second fiber (**semaphore serialization** — not a skipped STL path).
- **Third cycle:** Another `reReadRemoteTracking` pair (`start` / `done` `1776960395940` → `1776960400628`) followed by `tracking.getStatus`; by then inbound counters are **~43k** cumulative.
- **Certain from C:** **Multiple** `reReadRemoteTracking` **completions** occur in the same run as **large, still-growing** `workspaceFileEventsToPubSub` / `statusBarPubSubInboundPreDebounce` totals — **H-remote-reread-during-churn**.
- **Not certain from C:** That each `reReadRemoteTracking` was a **separate org HTTP “check”** — **H-org-http** remains unproven without wire-level evidence.

## Conclusions tied to [pubsub-waste-findings.md](pubsub-waste-findings.md)

- **Phase 1 narrative (stream debounce only):** Logs show **massive** pre-debounce volume and **tiny** `statusBarAfterFirstFileDebounce` — downstream coalescing works for emissions **after** that debounce.
- **Cost still on the path before that debounce:** The status bar subscriber still executes the **pre-debounce** tap once per PubSub message (`statusBarPubSubInboundPreDebounce` tracks that). Scoped watchers + ignore (fix phase 3) reduce **how many messages exist**, not only post-debounce count.
- **Org / STL work:** `getStatus` and `trackingGetStatusInvoked` stay low relative to file noise, matching the doc’s “bounded by quiet windows / refresh cadence” story.
- **Record C (STL boundaries):** Proves **multiple remote tracking re-reads** (`reReadRemoteTracking`) during **ongoing** high-volume file churn; does **not** by itself prove **multiple org HTTP round-trips** (see **H-org-http**).

## Removing instrumentation

Delete the `// #region agent log` blocks when measurement is complete:

- [packages/salesforcedx-vscode-services/src/vscode/fileWatcherService.ts](../packages/salesforcedx-vscode-services/src/vscode/fileWatcherService.ts)
- [packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts](../packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts)
- [packages/salesforcedx-vscode-services/src/core/sourceTrackingService.ts](../packages/salesforcedx-vscode-services/src/core/sourceTrackingService.ts) (includes `getStatus` + STL boundary logging)
