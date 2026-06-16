# Defer extension activation where possible

VS Code auto-activates an extension when one of its commands runs, a contributed language's file opens, or a contributed view opens; we defer activation wherever possible to protect startup performance. Only `salesforcedx-vscode-core` (a runtime dependency of the others) starts on any dx project, and `salesforcedx-vscode-apex` starts eagerly only because Jorje is slow to boot (revisit once fully on the new LS); everything else activates on-demand. (Pairs with [ADR-0015](./0015-extension-pack-staged-activation.md).)

## Considered Options

Activation patterns in use:

- **On-demand by command** — e.g. `salesforcedx-vscode-apex-oas`, no eager activation.
- **On contributed language file open** — `salesforcedx-vscode-visualforce`, `salesforcedx-vscode-soql`.
- **Debuggers** — activate via `onDebugResolve:apex` (in practice, more often by their commands).
- **Aura/LWC** — use `workspaceContains:path` (activate only if the project contains the relevant files; preserves some Core/Workspaces behavior).

Why Aura/LWC can't defer until one of their files opens:

1. Aura/LWC rely on their languages being JS/HTML/CSS to get built-in tooling; VS Code treats language ownership of a file as 1:1, so there's no "treat as JS **and** another language."
2. activationEvents has no "file opened matches pattern" option.
3. `onLanguage:javascript` would run the extension on all JS, including non-Salesforce projects.
4. activationEvents can't be `AND`ed (no "onLanguage:javascript AND workspaceContains").
5. `workspaceContains:path` activates if the project merely contains a matching file, even if the user never opens it.
