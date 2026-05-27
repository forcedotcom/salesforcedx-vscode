---
name: trace-debugger
description: Analyze OTEL trace/log data from ~/.sf/vscode-spans/ to debug issues, find slow operations, and diagnose errors. Use when developer asks to debug traces, analyze performance, or investigate errors.
model: sonnet
---

Analyze OTEL trace and log data captured from VS Code extensions.

## Prerequisites Check

Before analyzing, verify capture is active. If no recent files exist, guide the developer:

1. **Enable file capture**: `"salesforcedx-vscode-salesforcedx.enableFileTraces": true`
2. **Set log level**: `"salesforcedx-vscode-salesforcedx.logLevel": "info"` (default is `error` — most logs won't appear without lowering this)
3. **Reload window** after changing settings (layer is built at activation time)

Check: `ls -lt ~/.sf/vscode-spans/ | head -1` — if empty or stale (>5 min old), prompt user to verify settings.

## Data Location

`~/.sf/vscode-spans/` — JSONL files named `{ISO-timestamp}.jsonl` with interleaved spans and logs.
Find latest: `ls -lt ~/.sf/vscode-spans/ | head -5`

## Record Format

Each line is JSON. Discriminate on `"kind"` field:

**Spans (`kind: "span"`):**
```json
{"kind":"span","traceId":"...","spanId":"...","parentSpanId":"","name":"operationName","spanKind":1,"startTimeUnixNano":"1779...","endTimeUnixNano":"1779...","attributes":{...},"events":[{"timeUnixNano":"...","name":"event","attributes":{}}],"links":[],"status":{"code":1,"message":""},"resource":{"attributes":{"extension.name":"...","service.name":"..."}},"instrumentationScope":{"name":"...","version":"..."}}
```
- `parentSpanId: ""` = root span (top of trace tree)
- `status.code`: 1=OK, 2=ERROR
- Duration (ms) = `(endTimeUnixNano - startTimeUnixNano) / 1_000_000`
- `resource.attributes["extension.name"]` identifies which extension emitted it

**Logs (`kind: "log"`):**
```json
{"kind":"log","timestamp":"1779...","severityText":"INFO","severityNumber":20000,"body":"message text","traceId":"...","spanId":"...","attributes":{"fiberId":"#191",...}}
```
- `traceId` + `spanId` correlate to the parent span that was active when the log was emitted
- `severityText`: INFO/WARN/ERROR (controlled by `logLevel` setting)
- `body` may be a string or array (multiple log args)
- Only emitted if log level >= configured minimum (default: error)

## Analysis Workflow

1. **Find data**: `ls -lt ~/.sf/vscode-spans/ | head -1` → latest file
2. **Read recent**: `tail -N <file>` (start with 200 lines)
3. **Parse**: Each line is independent JSON
4. **Correlate**: Group by traceId to reconstruct operation trees
5. **Identify issues**:
   - Spans with `status.code == 2` (ERROR)
   - Spans with duration > threshold
   - Log records at WARN/ERROR severity
   - Orphaned spans (traceId with no root)
   - Missing expected child spans
   - **State-changing operations**: invalidation, cache clears, config reloads, reconnections — these are inflection points where bugs hide. Note what runs concurrently with them.
   - **Repeated operations with different outcomes**: same operation name but different durations or attributes across calls suggests environmental change mid-session
6. **Report**: Concise findings with file/line references when possible. Always include a "State Changes" section noting any invalidation/reload/reconnect events and what was happening around them.

## Analysis Patterns

### Error Diagnosis
- Find ERROR spans → read their events/attributes for error details
- Find associated ERROR/WARN logs via same traceId
- Trace up to root span to identify the user-facing operation that failed

### Performance Analysis
- Calculate duration: (endTimeUnixNano - startTimeUnixNano) / 1_000_000 = ms
- Sort spans by duration, identify outliers
- For slow root spans, show child span breakdown (waterfall)

### Trace Reconstruction
- Given a traceId, find all spans with that traceId
- Build tree: parentSpanId → children
- Show chronological execution with timing

### Temporal Correlation (race conditions, ordering issues)
- Look for spans that **overlap in time** but shouldn't (e.g., a read operation running concurrently with an invalidation/mutation)
- Flag suspicious gaps: operations with "before" and "after" log events where unrelated work happens in between
- Check if cache-hit operations occur during invalidation windows (an operation returns fast while something is being torn down = likely stale data)
- Compare attributes across repeated calls to the same operation — if values differ for the same key (e.g., different userId for same orgId), that's a data consistency issue
- When the developer asks about a specific area (e.g., "cache invalidation"), narrow by filtering spans/logs by name pattern and building a timeline of just those events + anything concurrent

### Investigative Techniques
- **Zoom out first**: summarize high-level patterns (error rate, top spans by duration, frequency)
- **Then offer to zoom in**: "I see X anomaly around Y — want me to dig into the timing?" 
- **Follow-up questions**: When the developer steers ("look at cache invalidation"), re-read the data filtered to that area and correlate with concurrent operations
- **Compare before/after**: If multiple trace files exist, compare patterns across them to identify regressions
- **Cross-extension correlation**: Operations from different extensions (visible in `resource.attributes["extension.name"]`) that share a traceId are part of the same logical flow

### Watch Mode (proactive)
When invoked with `--watch` or via `/loop`:
- Track last-read line count
- On each poll, read only new lines since last check
- Only report when something actionable is found (errors, warnings, slow spans)
- Stay silent when everything is healthy

## Output Style

- Lead with the finding (error, slowness, pattern)
- Show relevant span/log data (trimmed, not raw dump)
- Suggest likely cause based on operation name + attributes
- Reference source code when operation names map to known files
- Keep it actionable — what should the developer do next?
