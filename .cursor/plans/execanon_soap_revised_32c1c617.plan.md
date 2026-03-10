---
name: ExecAnon SOAP revised
overview: Replace Tooling executeAnonymous with inline SOAP, fix diagnostics lifecycle, change log-open UX to notification-driven. Plan includes exact SOAP reference code and field mappings from apex-node so a fast model can execute without hallucinating.
todos:
  - id: soap-transport
    content: 'Replace Tooling execAnon with inline SOAP: escapeXml, buildSoapBody, buildSoapRequest, parseSoapResponse helpers + rewire executeAnonymous and executeAndRetrieveLog. Remove TraceFlagService/ApexLogService deps.'
    status: completed
  - id: diagnostics-lifecycle
    content: Add clearDiagnostics(uri) to service, switch setDiagnostics to per-URI delete, wire clear-at-command-start in apex-log, register onDidCloseTextDocument cleanup.
    status: completed
  - id: apex-log-ux
    content: Split save from open in logStorage, wrap command in withProgress, show notification with Open Log action, add NLS keys.
    status: completed
  - id: tests
    content: Unit tests for SOAP parsing/building, diagnostics clearing. Update Playwright to expect notification-driven log open instead of auto-opened tab.
    status: completed
  - id: verification
    content: compile, lint, effect-ls diagnostics, test, bundle, web tests, knip, check:dupes
    status: completed
isProject: false
---

# ExecAnon SOAP + Diagnostics + Log UX

## Reference: apex-node SOAP implementation

The implementation model MUST reference these files in `node_modules/@salesforce/apex-node/lib/src/execute/` — do NOT hallucinate SOAP structures.

### SOAP request (`utils.js` + `executeService.js`)

**URL**: `{conn.instanceUrl}/services/Soap/s/{conn.version}/{conn.accessToken.split('!')[0]}`

**Headers**: `{ 'content-type': 'text/xml', soapaction: 'executeAnonymous' }`

**Body** (from `utils.js:19-37`):

```xml
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header>
        <cmd:SessionHeader>
            <cmd:sessionId>${accessToken}</cmd:sessionId>
        </cmd:SessionHeader>
        <apex:DebuggingHeader><apex:debugLevel>DEBUGONLY</apex:debugLevel></apex:DebuggingHeader>
    </env:Header>
    <env:Body>
        <executeAnonymous xmlns="http://soap.sforce.com/2006/08/apex">
            <apexcode>${escapedApexCode}</apexcode>
        </executeAnonymous>
    </env:Body>
</env:Envelope>
```

XML-escape the apex code using: `< > & " '` -> `< > & " '`

### SOAP response parsing (`executeService.js:135-159`, `types.d.ts:12-42`)

jsforce `conn.request()` auto-parses XML via `xml2js` with `{ explicitArray: false }`. Response is a JS object:

```typescript
// response shape after xml2js parsing
type SoapResponse = {
  'soapenv:Envelope': {
    'soapenv:Header'?: {
      DebuggingInfo: { debugLog: string };
    };
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          column: number;
          compiled: string; // 'true' | 'false' (STRING, not boolean)
          compileProblem: string | object; // empty XML element -> {} from xml2js
          exceptionMessage: string | object; // same
          exceptionStackTrace: string | object; // same
          line: number;
          success: string; // 'true' | 'false' (STRING)
        };
      };
    };
  };
};
```

### Field mapping to jsforce ExecuteAnonymousResult

The current code and both consumers type results as jsforce's `ExecuteAnonymousResult`:

```typescript
// node_modules/jsforce/lib/api/tooling.d.ts:8-16
type ExecuteAnonymousResult = {
  compiled: boolean;
  compileProblem: string | null;
  success: boolean;
  line: number;
  column: number;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
};
```

Conversion from SOAP `ExecAnonApiResponse` to `ExecuteAnonymousResult`:

- `compiled`: `soapResult.compiled === 'true'`
- `success`: `soapResult.success === 'true'`
- `line`: `Number(soapResult.line)`
- `column`: `Number(soapResult.column)`
- `compileProblem`: `typeof soapResult.compileProblem === 'object' ? null : soapResult.compileProblem`
- `exceptionMessage`: same pattern
- `exceptionStackTrace`: same pattern

**Debug log**: `response['soapenv:Envelope']['soapenv:Header']?.DebuggingInfo.debugLog` — may be absent if no header returned.

**logId**: SOAP does not return a log ID. `logId` will be `undefined`. Callers already handle `logId?: string` (see `[logStorage.ts:69](packages/salesforcedx-vscode-apex-log/src/logs/logStorage.ts)` — folder name just omits ID suffix when undefined).

### Transport

Use `conn.request()` which is already used in this codebase for raw HTTP:

```typescript
// existing pattern from apexLogService.ts:84-87
const res = await conn.request({ method: 'GET', url });
```

---

## Todo 1: SOAP transport in ExecuteAnonymousService

**File**: `[packages/salesforcedx-vscode-services/src/core/executeAnonymousService.ts](packages/salesforcedx-vscode-services/src/core/executeAnonymousService.ts)`

Changes:

- Add helper functions (outside the class): `escapeXml`, `buildSoapBody`, `buildSoapRequest`, `parseSoapResponse`
  - `buildSoapRequest(conn)` returns `{ method, url, body, headers }` using `conn.instanceUrl`, `conn.accessToken`, `conn.version`
  - `parseSoapResponse(raw)` converts the xml2js-parsed object to `{ result: ExecuteAnonymousResult, logBody: string }`
  - Handle absent `soapenv:Header` defensively: return empty string for logBody
  - Handle `typeof field === 'object'` -> `null` for compileProblem/exceptionMessage/exceptionStackTrace (xml2js empty-element quirk)
- Replace `executeAnonymous` body: use `conn.request(buildSoapRequest(conn, code))` instead of `conn.tooling.executeAnonymous(code)`, parse with `parseSoapResponse`
- Replace `executeAndRetrieveLog` body: remove trace flag + listLogs + getLogBody flow. Instead, call `executeAnonymous(code)` which now returns `{ result, logBody }`. Return `{ result, logBody, logId: undefined }`.
  - Keep the return shape `{ result, logBody, logId }` for backward compat with both consumers
- Remove `TraceFlagService` and `ApexLogService` from `dependencies` array (no longer needed for execAnon)
  - **Wait**: check if they're used elsewhere in this service. They're not — this service only has `executeAnonymous`, `executeAndRetrieveLog`, `reportExecResult`. TraceFlagService and ApexLogService were only used in `executeAndRetrieveLog`.
- Update imports: remove `TraceFlagService`, `ApexLogService`. Keep `ConnectionService`, `ChannelService`.

Do NOT add `@salesforce/apex-node` as a dependency. Reimplement the SOAP helpers inline using the reference code above.

---

## Todo 2: Diagnostics lifecycle

**File**: `[packages/salesforcedx-vscode-services/src/core/executeAnonymousService.ts](packages/salesforcedx-vscode-services/src/core/executeAnonymousService.ts)`

- Add `clearDiagnostics` method: `(uri: URI) => Effect.sync(() => diagnostics.delete(vscode.Uri.parse(uri.toString())))`
- In `setDiagnostics`: replace `diagnostics.clear()` with `diagnostics.delete(vscode.Uri.parse(uri.toString()))` for per-URI cleanup
- On success (no errors), still call `diagnostics.delete(uri)` to clear previous errors for that URI
- Add `clearDiagnostics` to the returned API: `return { executeAnonymous, executeAndRetrieveLog, reportExecResult, clearDiagnostics }`
- Update the service type in `[packages/salesforcedx-vscode-services/src/index.ts](packages/salesforcedx-vscode-services/src/index.ts)` if needed (it uses `typeof ExecuteAnonymousService` so adding to return should auto-propagate)

**File**: `[packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts](packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts)`

- At start of `executeAnonymous` fn: call `api.services.ExecuteAnonymousService.clearDiagnostics(context.uri)` before executing
- On compile error path: call `reportExecResult` (currently skipped) so diagnostics get set for compile errors too, then show toast. Or: keep current toast-only path but let `clearDiagnostics` at start handle stale clearing.

**File**: `[packages/salesforcedx-vscode-apex-log/src/index.ts](packages/salesforcedx-vscode-apex-log/src/index.ts)`

- Register `vscode.workspace.onDidCloseTextDocument` in activation
- When closed doc has `.apex` languageId or is untitled, call `api.services.ExecuteAnonymousService.clearDiagnostics(URI.parse(doc.uri.toString()))`
- Push the disposable to `context.subscriptions`

---

## Todo 3: Notification-driven log open UX

**File**: `[packages/salesforcedx-vscode-apex-log/src/logs/logStorage.ts](packages/salesforcedx-vscode-apex-log/src/logs/logStorage.ts)`

- Rename `saveExecResultAndOpenLog` to `saveExecResult` (or add a new function that saves without opening)
- Remove the `showTextDocument` call at the end
- Return the `logUri` so callers can open it on demand

**File**: `[packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts](packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts)`

- Wrap entire `executeAnonymous` body in `vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: nls.localize('...'), cancellable: false }, ...)`
  - Title must use `nls.localize()` (ESLint rule: `noVscodeProgressTitleLiterals`)
- After save, show notification: `vscode.window.showInformationMessage(nls.localize('exec_anon_success'), nls.localize('open_log'))` — if user clicks "Open Log", open the logUri
- Add new NLS keys to `[packages/salesforcedx-vscode-apex-log/src/messages/i18n.ts](packages/salesforcedx-vscode-apex-log/src/messages/i18n.ts)`

**Replay debugger**: `[packages/salesforcedx-vscode-apex-replay-debugger/src/commands/anonApexDebug.ts](packages/salesforcedx-vscode-apex-replay-debugger/src/commands/anonApexDebug.ts)` — no changes needed. It already uses `logBody` directly (passes to `launchReplayDebugger`), never opens `debug.log` tab. Confirm SOAP still provides `logBody` (it does — from DebuggingInfo header).

---

## Todo 4: Tests

**Unit tests** in `salesforcedx-vscode-services`:

- Test `parseSoapResponse` with: full success response, compile error, absent header (no log), empty-object fields
- Test `buildSoapRequest` produces correct URL and XML
- Test `clearDiagnostics` calls `diagnostics.delete` for specific URI

**Unit tests** in `salesforcedx-vscode-apex-log`:

- Test that `executeAnonymous` calls `clearDiagnostics` at start
- Test notification-driven flow (mock `showInformationMessage` to simulate user clicking "Open Log")

**Playwright** at `[packages/salesforcedx-vscode-apex-log/test/playwright/specs/executeAnonymous.headless.spec.ts](packages/salesforcedx-vscode-apex-log/test/playwright/specs/executeAnonymous.headless.spec.ts)`:

- Step "execute document": change from expecting `debug.log` tab to expecting a notification with "Open Log" action. Click the action, then expect the tab.
- Step "execute selection": same change
- Step "compile error": unchanged (already expects error notification)
- Consider adding: after compile error, fix code, re-execute, verify error diagnostics cleared

**Reusable helpers** in `playwright-vscode-ext`: add helpers for asserting Problems panel / diagnostics if useful for multiple packages.

---

## Todo 5: Verification

Per `[/.claude/skills/verification/SKILL.md](.claude/skills/verification/SKILL.md)`:

- `npm run compile`
- `npm run lint`
- `npx effect-language-service diagnostics --project tsconfig.json`
- Review changed `.ts` files against [paths skill](.claude/skills/paths/SKILL.md) — use vscode-uri not node:path
- Review Effect code against [effect-best-practices skill](.claude/skills/effect-best-practices/SKILL.md)
- `npm run test`
- `npm run vscode:bundle`
- `npm run test:web -w salesforcedx-vscode-apex-log -- --retries 0` (primary — exec anon tests live here)
- `npm run test:desktop -w salesforcedx-vscode-apex-log -- --retries 0` (primary — exec anon tests live here)
- `npm run test:web -w salesforcedx-vscode-services -- --retries 0`
- `npm run test:desktop -w salesforcedx-vscode-services -- --retries 0`
- `npx knip`
- `npm run check:dupes`

---

## Key Decisions / Gotchas for the Implementing Model

1. **Do NOT import from `@salesforce/apex-node`**. Copy the SOAP logic inline, referencing the code above.
2. **xml2js empty-element quirk**: empty XML elements become `{}` not `''` or `null`. Use `typeof x === 'object' ? null : x`.
3. **String booleans**: SOAP returns `'true'`/`'false'` strings, not booleans. Must convert.
4. `**logId` is undefined in SOAP path. This is fine — `saveExecResultAndOpenLog` already handles it (folder name omits suffix).
5. **TraceFlagService/ApexLogService removal**: only remove from `ExecuteAnonymousService.dependencies`. They're still used by other services and by apex-log extension directly.
6. `**conn.request()` auto-parses XML: jsforce uses xml2js under the hood. Do NOT manually parse XML — `conn.request()` returns the parsed JS object directly.
7. **Progress title**: must use `nls.localize()`, not a string literal (ESLint rule).
8. `**diagnostics.delete(uri)` removes diagnostics for one URI only, unlike `diagnostics.clear()` which removes all.
