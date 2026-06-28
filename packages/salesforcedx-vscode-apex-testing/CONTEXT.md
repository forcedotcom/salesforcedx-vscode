# salesforcedx-vscode-apex-testing Context

## Glossary

### org-only test

- in org, not in workspace; `org-only` TestTag
- debug unsupported
- retrieve (`MetadataRetrieveService.retrieve`, org→workspace) to edit locally — retrieve, not deploy

### project test

- in workspace; `in-workspace` TestTag
- runs against the org's copy
- undeployed classes absent from tree (org-discovery consequence; no in-code deploy gate)

### TestController shell

- `ApexTestController` OO class wrapping `vscode.tests.createTestController`
- class shell forced by the Test API object model

### discovery VFS

- `apex-testing:` scheme; `/orgs/<orgKey>/classes/<FullName>.cls`
- read-only virtual editor backing org-only classes

### delegate command

- LS-emitted `*.delegate` lens IDs → real targets
- see [ADR 0001](./docs/adr/0001-codelens-delegate-commands.md)

### namespace/package grouping

- tree: namespace → package (2GP/1GP/unpackaged) → class → method

## Effect-TS Architecture

### Error handling

- Services throw errors as `Schema.TaggedError` types, never raw exceptions
- Callers use `Effect.catchTags` to handle specific error types by tag
- Errors not caught are converted to UserCancellationError or logged/shown

### State management

- Coverage decorations stored in `Ref<Range[]>` (mutable state within `CodeCoverageService`)
- Active-editor repainting via `EditorService.pubsub` fork (`watchActiveEditorForCoverage`) from `index.ts`
- No disposables; lifecycle managed by extension scope

### File operations

- All file I/O via `FsService` (not raw `workspace.fs`)
- `stat` accepts `string | URI`; `readFile`/`readDirectoryWithTypes` for batch operations
- Result file aggregation uses sequential reads + chronological sort (last-write-wins)
