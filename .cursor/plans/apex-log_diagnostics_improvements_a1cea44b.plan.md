---
name: apex-log diagnostics improvements
overview: Add diagnostics reporting and output channel messaging to the apex-log extension's anonymous apex execution flow, adapting the patterns from the replay debugger's anonApexDebug.ts.
todos:
  - id: diagnostics-fn
    content: Create executeAnonymousDiagnostics.ts with Effect function that sets vscode.DiagnosticCollection from ExecuteAnonymousResult
    status: completed
  - id: output-channel
    content: Add output channel messaging (compile success/fail, runtime exception) using ChannelService
    status: completed
  - id: editor-context
    content: Add getActiveEditorContext to EditorService returning text + uri + selectionRange
    status: completed
  - id: wire-commands
    content: Update executeAnonymous.ts to use getActiveEditorContext and call diagnostics + output after executeAndRetrieveLog
    status: completed
  - id: verify
    content: Compile, lint, test, bundle, knip, check:dupes
    status: completed
isProject: false
---

# Apex-Log Anonymous Apex Error Reporting Improvements

## Current State

The apex-log execute anonymous flow ([executeAnonymous.ts](packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts)) does:

1. Get code from active editor
2. Call `ExecuteAnonymousService.executeAndRetrieveLog(code)`
3. Save result.json + script.apex + debug.log to disk, open debug.log

What it does **not** do when execution fails (`result.success === false`):

- No `DiagnosticCollection` -- compile errors / runtime exceptions don't appear as squiggly lines in the editor
- No output channel messaging -- success/failure text not written anywhere the user can scan
- No distinction between compile failure and runtime exception in user-facing feedback

The generic `ErrorHandlerService.handleCause` only fires for _Effect failures_ (e.g. network errors). A successful HTTP call returning `{ compiled: false, compileProblem: "..." }` is a **success** from the Effect perspective, so the error handler never runs -- the user just gets the log opened with no indication something went wrong.

## Reference: replay-debugger anonApexDebug.ts

Key functions to adapt from [anonApexDebug.ts](packages/salesforcedx-vscode-apex-replay-debugger/src/commands/anonApexDebug.ts):

- `handleDiagnostics` (lines 71-95): Creates a `DiagnosticCollection`, sets error range + message from `compileProblem` or `exceptionMessage`
- `outputResult` (lines 59-69): Writes compile/runtime success or failure text to output channel
- `processResult` (lines 97-108): Orchestrates both

The `ExecuteAnonymousResult` type from jsforce:

```typescript
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

## Proposed Changes

### 1. Create diagnostics + output channel function

New file: `packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymousDiagnostics.ts`

Effect function that accepts `ExecuteAnonymousResult` and:

- **Diagnostics**: Sets a `vscode.DiagnosticCollection` with error range + message when `compiled === false` or `success === false`. Clears on each invocation. Uses a module-level `vscode.languages.createDiagnosticCollection('apex-anon-errors')`.
- **Output channel**: Writes status via `ChannelService.appendToChannel`:
  - Success: "Compile: success / Execute: success"
  - Compile fail: "Error: Line X, Column Y -- {compileProblem}"
  - Runtime exception: "Compile: success / Error: {exceptionMessage}\n{exceptionStackTrace}"

### 2. Wire into executeAnonymous command

Update [executeAnonymous.ts](packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts) to call the new function after `executeAndRetrieveLog` returns, before `saveExecResultAndOpenLog`.

### 3. Extend EditorService with `getActiveEditorContext`

Update [editorService.ts](packages/salesforcedx-vscode-services/src/vscode/editorService.ts) to add a new accessor alongside the existing ones:

```typescript
const getActiveEditorContext = Effect.fn('EditorService.getActiveEditorContext')(function* (selection: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return yield* Effect.fail(new NoActiveEditorError({ message: 'No active text editor is currently open' }));
  }
  const useSelection = selection && !editor.selection.isEmpty;
  return {
    text: useSelection ? editor.document.getText(editor.selection) : editor.document.getText(),
    uri: URI.parse(editor.document.uri.toString()),
    selectionRange: useSelection
      ? { startLine: editor.selection.start.line, startCharacter: editor.selection.start.character }
      : undefined
  };
});
```

This gives the caller text + URI + optional selection start in one call. The diagnostics function uses `selectionRange.startLine` to offset reported line numbers (matching the replay-debugger behavior).

Update the return to include it: `return { pubsub, getActiveEditorUri, getActiveEditorText, getActiveEditorContext };`

Then update `executeAnonymous.ts` to use `getActiveEditorContext` instead of `getActiveEditorText`, passing the context through to the diagnostics function.

### Decisions

- **DiagnosticCollection lifetime**: Module-level const (matches replay-debugger pattern, simplest).
- **URI for diagnostics**: Comes from `getActiveEditorContext` return value.
