---
name: vscode-extension-launch
description: Maintain this repository's VS Code extension launch configs when adding or removing extension packages, changing launch groups, or adding subset debug configurations.
---

# VS Code extension launches

Before changing extension packages or extension-host launch configurations, read these related files:

- `.vscode/launch.json` for debug configurations and their `preLaunchTask` values.
- `.vscode/tasks.json` for build and selection task order.
- `scripts/extension-groups.json` for named subsets.
- `scripts/selectedExtensions.mjs` and `scripts/pickExtensions.mjs` for discovery, dependency expansion, and the generated selection directory.

When removing an extension, check `scripts/extension-groups.json` for references to its package directory name. Update any affected group, then check the corresponding tasks and launch configurations. Also check whether its removal changes another extension's declared `extensionDependencies`.

When adding a launch configuration for a subset, add a named group in `scripts/extension-groups.json` and have a prelaunch task call `scripts/pickExtensions.mjs --group <name>`. Pass `--extensionDevelopmentPath=${workspaceFolder}/.vscode/selected-extensions` in the launch config. Keep the package list out of `launch.json`; the picker creates the links for the selected group. The generated directory is ignored by Git and should not be committed.

Preserve build behavior when changing launch configs. Configurations that previously built must still run the full `Compile and Bundle` task. For build-enabled extension launches, use `dependsOrder: "sequence"` with `Compile and Bundle` before the picker task. Selecting a subset controls what launches, not what gets built. Keep the broad `outFiles` patterns for source maps unless there is a concrete reason to change them.

Verify that each extension-host launch config's `preLaunchTask` exists, the intended group resolves to real extension packages, and any build-enabled task reaches `Compile and Bundle` before selection.
Run `pnpm run check:extension-launch` after changing an extension package, group, picker task, or extension-host launch configuration. This check also runs in the repository's test and precommit workflows.
