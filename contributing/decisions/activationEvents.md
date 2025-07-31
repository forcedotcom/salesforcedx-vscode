# Extension Activation Events

Extensions can define `activationEvents`

They're **automatically** activated if any of

- one of their commands is run
- a language they contribute has a file that's opened.
- a `view` they provide is opened in the sidebar

We want to defer activation where possible to improve performance.

## Extension Behavior

### start on any dx project

`salesforcedx-vscode-core` because it's used by all the other extensions as a runtime dependency
`salesforcedx-vscode-apex` because `jorje` is so slow to start that we don't want users to wait. Once we're all-in on the new LS we can reconsider this behavior

### automatically start when a relevant file is open

these extensions have a language in their `contributes` and run whenever an associated file is opened

- `salesforcedx-vscode-visualforce`
- `salesforcedx-vscode-soql`

### debuggers

both debugger extensions are activated when debugging an apex file via "onDebugResolve:apex".
In practice, they'll more likely be activated by their commands

### Aura/LWC

There's no good way to defer these until one of their files are loaded.

1. you can define languages for extensions (like SOQL and VF do), but Aura/LWC rely on their languages being JS, HTML, CSS etc to benefit from other built-in tooling. There's not a good way to say, "treat it as JS **and** another language." Language "ownership" of a file is 1:1 in vscode's thinking.
2. activation events doesn't have a "file opened matches pattern" option.
3. you can attach to "onLanguage:javascript" for example, but each extension will run on all JS (Aura, LWC, other JS not in salesforce projects)
4. activationEvents can't be `AND` (like you can't say, "onLanguage:javascript" AND workspaceContains)
5. you can match a file pattern via `workspaceContains:path` but it activates if the project contains a matching file even if user never opens it.

Decision: use the `workspaceContains:path` to activate, but only if the project contains the relevant files.

note: we'll preserve some internal Core/Workspaces behavior for LWC/Aura.
