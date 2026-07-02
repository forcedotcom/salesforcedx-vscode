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

### Errors

- `Schema.TaggedError`, never raw exceptions
- handle by tag via `Effect.catchTags`
- uncaught → UserCancellationError or logged/shown

### State

- coverage decorations in `Ref<Range[]>` within `CodeCoverageService`
- active-editor repaint via `EditorService.pubsub` fork (`watchActiveEditorForCoverage`) from `index.ts`
- no disposables; lifecycle = extension scope

### File ops

- all I/O via `FsService`, not raw `workspace.fs`
- `stat` takes `string | URI`; `readFile`/`readDirectoryWithTypes` for batch
- result aggregation: sequential reads + mtime sort (last-write-wins)
