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
      "command": ["./packages/drivable-vscode/bin/drivable-vscode-mcp.js"]
    }
  }
}
```

`start` defaults to packaged VSIX mode and accepts an acceptance objective plus an optional existing `orgAlias`. Pass `extensionMode: "dev"` after running `npm run vscode:bundle` to load development paths. Actions require the latest observation sequence and permit role-based click/fill (optionally scoped with `within: { role, name }`), typing, key presses, command-palette actions, and bounded text waits only.

This MCP server is a Node stdio process, not a VS Code extension host. Do not import `@salesforce/effect-ext-utils` here: that package's barrel loads `vscode` at require time and crashes MCP startup. Decode extension `name`, `publisher`, and `version` with a local Effect Schema in `src/extensionService.ts`.

See `.claude/skills/drivable-vscode/SKILL.md` for Claude Code, OpenCode, and Cursor setup plus scripted and agent-driven workflows. Run the validated scripted example with:

```bash
npm run vscode:bundle
node packages/drivable-vscode/scripts/drivable-vscode-example.mjs
```

Org Browser catalog manual coverage (requires authenticated `orgBrowserDreamhouseTestOrg`): retrieve `Broker__c.Email__c` (workspace `force-app` file, filled icon, not shadow), then retrieve `Broker__c` twice and confirm the `window.dialogStyle: custom` overwrite modal with `Yes`. Also Report folders and Hide Local/Hide Org.

```bash
npm run vscode:bundle
node packages/drivable-vscode/scripts/catalog-manual-coverage.mjs
```

Text observations, console entries, findings, artifact JSON, and MCP text responses scrub common credential forms. Screenshots and video are not pixel-redacted and can contain secrets displayed by VS Code. Native OS dialogs and external windows remain outside Playwright's Electron page.
