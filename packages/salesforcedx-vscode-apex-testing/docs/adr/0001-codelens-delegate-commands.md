# CodeLens "delegate" commands

The Apex Language Server (Jorje) emits the **Run Test / Debug Test / Run All Tests** CodeLenses above `@IsTest` code. Each lens carries a hard-coded command ID — `sf.apex.{test,debug}.{class,method}.run.delegate` — and a `ns.class.method` string argument. These IDs are owned by the LS, not by this extension: they appear in no `package.json` `contributes.commands` block, and the LS source is painful to change. So the extension registers them as thin **delegate** handlers (`apexTestRunCodeAction.ts`) that immediately `executeCommand` the real target. Delegates are the seam between the fixed LS contract and our implementation.

## Why a redirect instead of pointing the LS at the real command

We can't repoint the LS, and we want a single uniform lens shape (every lens → one `*.delegate` ID) so routing decisions live here, not in Jorje. The delegate layer lets one LS contract fan out to different targets:

- **run** → `sf.apex.test.{class,method}.run` (the real `Effect.fn` test-run pipeline)
- **debug** → `sf.test.view.{debugTests,debugSingleTest}`, registered in `salesforcedx-vscode-apex-replay-debugger`, **reshaping** the raw `string` arg into the `{ name }` object that command expects

The debug delegates earn their keep via that retarget + arg reshaping. The **run** delegates are pure passthroughs today (no reshaping) — kept for contract uniformity and because the LS-emitted ID can't trivially be changed to the real one.

## Namespace caveat

`ns.class.method` args are rewritten before dispatch — see `salesforcedx-vscode-apex/src/namespaceLensRewriter.ts` (CodeLens middleware) stripping the project namespace per [#6458](https://github.com/forcedotcom/salesforcedx-vscode/issues/6458).

## Consequences

- The four `*.run.delegate` IDs are an external contract with the LS; renaming them silently breaks every CodeLens. They are not in `package.json` on purpose — they're not user-invokable commands.
- New lens-triggered behavior routes through a delegate, not by asking the LS team to emit a new command ID.
- Delegates stay plain `executeCommand` shims (no Effect runtime); only the real targets they call are `Effect.fn` pipelines.
