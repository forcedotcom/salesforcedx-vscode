# CodeLens "delegate" commands

The Apex Language Server (Jorje) emits **Run Test / Debug Test / Run All Tests** CodeLenses with hard-coded IDs — `sf.apex.{test,debug}.{class,method}.run.delegate` — and `ns.class.method` string arguments. The extension registers thin delegate handlers (`apexTestRunCodeAction.ts`) that `executeCommand` the real target.

## Why delegates

Repointing the LS requires a simultaneous LS+extension release, which we avoid. A uniform lens shape (every lens → one `*.delegate` ID) keeps routing decisions in the extension, not Jorje. One LS contract fans out to different targets:

- **run** → `sf.apex.test.{class,method}.run` (the `Effect.fn` test-run pipeline)
- **debug** → `sf.test.view.{debugTests,debugSingleTest}` in `salesforcedx-vscode-apex-replay-debugger`, reshaping the raw `string` arg into the `{ name }` object that command expects

The **run** delegates are pure passthroughs (no reshaping) — kept for contract uniformity.

## Namespace caveat

`ns.class.method` args are rewritten before dispatch — see `salesforcedx-vscode-apex/src/namespaceLensRewriter.ts` per [#6458](https://github.com/forcedotcom/salesforcedx-vscode/issues/6458).

## Consequences

- `*.run.delegate` IDs are an LS contract; renaming silently breaks all CodeLenses. Absent from `package.json` — not user-invokable.
- New lens behavior routes through a delegate, not a new LS-emitted ID.
