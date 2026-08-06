# @salesforce/vscode-visual-qa

Agent-driven visual QA for the Salesforce VS Code extensions. The MCP server owns one isolated VS Code Electron session and exposes constrained `start`, `observe`, `act`, `add_finding`, `status`, and `finish` tools.

## Build

Package the canonical 15 extensions, then compile this package:

```bash
npm run vscode:package
npm run compile -w @salesforce/vscode-visual-qa
```

## MCP Configuration

```json
{
  "mcp": {
    "salesforce-visual-qa": {
      "type": "local",
      "command": ["./packages/salesforcedx-vscode-visual-qa/bin/visual-qa-mcp.js"]
    }
  }
}
```

`start` defaults to packaged VSIX mode and accepts an acceptance objective plus an optional existing `orgAlias`. Pass `extensionMode: "dev"` after running `npm run vscode:bundle` to load development paths. Actions require the latest observation sequence and permit role-based click/fill, typing, key presses, command-palette actions, and bounded text waits only.

Text observations, console entries, findings, artifact JSON, and MCP text responses scrub common credential forms. Screenshots and video are not pixel-redacted and can contain secrets displayed by VS Code. Native OS dialogs and external windows remain outside Playwright's Electron page.
