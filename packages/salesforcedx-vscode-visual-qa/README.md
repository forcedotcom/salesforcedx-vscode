# drivable-vscode

drivable-vscode provides remote visual presence and operation in a running VS Code instance, supporting scripted automation and open-ended agent exploration. The MCP server owns one isolated VS Code Electron session at a time and exposes constrained `start`, `observe`, `act`, `add_finding`, `status`, and `finish` tools. Call `finish` before starting another session in the same MCP process.

## Build

Compile the MCP server:

```bash
npm run compile -w @salesforce/drivable-vscode
```

VSIX mode runs the cached packaging graph for the canonical 15 extensions before launch. For faster source iteration, run `npm run vscode:bundle` and pass `extensionMode: "dev"`.

## MCP Configuration

```json
{
  "mcp": {
    "drivable-vscode": {
      "type": "local",
      "command": ["./packages/salesforcedx-vscode-visual-qa/bin/drivable-vscode-mcp.js"]
    }
  }
}
```

`start` defaults to packaged VSIX mode and accepts an acceptance objective plus an optional existing `orgAlias`. Pass `extensionMode: "dev"` after running `npm run vscode:bundle` to load development paths. Actions require the latest observation sequence and permit role-based click/fill, typing, key presses, command-palette actions, and bounded text waits only.

See `.claude/skills/drivable-vscode/SKILL.md` for Claude Code, OpenCode, and Cursor setup plus scripted and agent-driven workflows. Run the validated scripted example with:

```bash
npm run vscode:bundle
node packages/salesforcedx-vscode-visual-qa/scripts/drivable-vscode-example.mjs
```

Text observations, console entries, findings, artifact JSON, and MCP text responses scrub common credential forms. Screenshots and video are not pixel-redacted and can contain secrets displayed by VS Code. Native OS dialogs and external windows remain outside Playwright's Electron page.
