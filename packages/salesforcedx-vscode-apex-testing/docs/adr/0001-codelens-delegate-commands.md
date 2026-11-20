# CodeLens commands

The Apex Language Server (Jorje) emits **Run Test / Debug Test / Run All Tests** CodeLenses with `ns.class.method` string arguments. Run Test lenses use the Apex Testing commands directly: `sf.apex.test.{class,method}.run`. Debug Test lenses use `sf.apex.debug.{class,method}.run.delegate` and are delegated by Apex Testing to Replay Debugger commands.

## Why debug delegates

Debug commands must adapt the raw language-server string argument to the `{ name }` object accepted by Replay Debugger. The delegate keeps that routing decision in Apex Testing instead of Jorje:

- **debug** → `sf.test.view.{debugTests,debugSingleTest}` in `salesforcedx-vscode-apex-replay-debugger`, reshaping the raw `string` arg into the `{ name }` object that command expects

Run commands require no argument reshaping, so Apex Testing registers them directly with the CodeLens API and does not register pass-through delegate commands.

## Namespace caveat

`ns.class.method` args are rewritten before dispatch — see `salesforcedx-vscode-apex/src/namespaceLensRewriter.ts` per [#6458](https://github.com/forcedotcom/salesforcedx-vscode/issues/6458).

## Consequences

- Debug `*.run.delegate` IDs are an LS contract; renaming silently breaks Debug Test CodeLenses. They are absent from `package.json` and not user-invokable.
- Run Test CodeLenses target Apex Testing commands directly, so Replay Debugger has no runtime dependency on the Apex extension.
