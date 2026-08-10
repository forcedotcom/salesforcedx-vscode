---
name: drivable-vscode
description: Operate a real VS Code instance through drivable-vscode. Use for visual QA, exploratory testing, customer bug reproduction, feature verification, screenshots, videos, or other evidence from VS Code.
review: always
---

# drivable-vscode

Remote visual presence and operation in a running VS Code instance.

## Setup

From repo root:

```bash
npm install
npm run compile -w @salesforce/drivable-vscode
```

`start` runs the cached `vscode:package` graph before VSIX launch. For faster source iteration, run `npm run vscode:bundle`, then start with `extensionMode: "dev"`.

### Claude Code

```bash
claude mcp add --scope local drivable-vscode -- ./packages/salesforcedx-vscode-visual-qa/bin/drivable-vscode-mcp.js
claude mcp get drivable-vscode
```

Restart Claude Code after adding the server. Check `/mcp` when tools are unavailable.

### OpenCode

Add to `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "drivable-vscode": {
      "type": "local",
      "command": ["./packages/salesforcedx-vscode-visual-qa/bin/drivable-vscode-mcp.js"],
      "enabled": true,
      "timeout": 10000
    }
  }
}
```

Restart OpenCode. Verify with `opencode mcp list`.

### Cursor

```bash
cursor --add-mcp '{"name":"drivable-vscode","command":"./packages/salesforcedx-vscode-visual-qa/bin/drivable-vscode-mcp.js"}'
```

Or add the same command under `mcpServers.drivable-vscode` in `.cursor/mcp.json`. Restart Cursor, then enable drivable-vscode under **Settings > Tools & MCP**.

## Choose Workflow

### Scripted

Use for repeatable checks or a scenario matrix. Drive MCP with a client, assert observations, always call `finish`.

Validated example:

```bash
npm run vscode:bundle
node packages/salesforcedx-vscode-visual-qa/scripts/drivable-vscode-example.mjs
```

Example source: `packages/salesforcedx-vscode-visual-qa/scripts/drivable-vscode-example.mjs`.

### Agent-Driven

Use for open-ended goals, exploratory testing, bug reproduction, or evidence capture.

1. Call `start` with the goal. Add `orgAlias` only when the scenario needs an authenticated org.
2. Call `observe`; inspect screenshot plus ARIA/text state.
3. Choose 1 action justified by that observation.
4. Call `act` with the latest observation sequence.
5. Wait with `waitForText` for a specific expected transition; never sleep or retry blindly.
6. Call `observe` again.
7. Repeat until the goal passes, fails, or reaches a documented limitation.
8. Call `add_finding` immediately for each defect, including reproduction steps and evidence paths.
9. Call `finish`; report the artifact directory and relevant screenshots/video.

Prompt example:

```text
Use drivable-vscode to reproduce the reported deploy-command failure. Explore the workflow from a clean VS Code session, record defects as findings, and finish with screenshot/video evidence and exact reproduction steps.
```

## Rules

- 1 server process owns at most 1 active session. Call `finish` before starting another.
- Observe before every action; stale sequences fail by design.
- Prefer role/name actions and command titles visible in the latest observation.
- Treat unexpected UI and tool errors as evidence, not signals to improvise fallback selectors.
- `finish` on success and failure; it saves final screenshot, video, action log, console log, findings, and summary.
- Text artifacts redact common credentials. Screenshots/video do not; avoid displaying secrets.
- Native OS dialogs and external windows are outside drivable-vscode control.
