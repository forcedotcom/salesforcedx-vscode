---
name: gha-rerun
description: Watch open PRs by mshanemc on forcedotcom/salesforcedx-vscode. Rerun failed GitHub Actions jobs up to 3x (GitHub run_attempt 1→4). Desktop-notify via terminal-notifier when maxed. Use when user says "gha-rerun", "watch my CI", "rerun my failed CI", "babysit my PRs", or similar.
model: haiku
---

# gha-rerun

Launch/manage detached bash daemon watching GitHub Actions for PRs by `@me` on `forcedotcom/salesforcedx-vscode`, auto-reruns failed jobs.

Daemon at `${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh`. Don't inline-rewrite; just run.

## Per invocation

1. **Preflight** (all required):
   - `command -v gh` — error → `https://cli.github.com/`
   - `command -v jq` — error → `brew install jq`
   - `command -v terminal-notifier` — error → `brew install terminal-notifier`
   - `gh auth status` — fails → `gh auth login`

   Any missing → print install command(s), **stop**.

2. **Check running** via `pgrep -f gha-rerun-daemon`.
   - PID returned = **status invocation**. Don't spawn.
     - Print: PID, uptime (`ps -o etime= -p <pid>`), last 30 lines of `${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`.
     - Print tracked PRs via the daemon's `gh pr list` command.
     - Ask: kill? Yes → `pkill -f gha-rerun-daemon`.
     - Exit.
   - No PID → step 3.

3. **Executable**: `chmod +x ${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh`. Missing file → "daemon script missing at ... — reinstall the agent".

4. **Launch detached**:

   ```bash
   nohup ${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh </dev/null >/dev/null 2>&1 &
   disown
   ```

5. **Verify**: `sleep 1; pgrep -f gha-rerun-daemon` returns PID. Print PID, log path (`${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`), notified-list (`/tmp/gha-rerun-notified.txt`). Stop: `pkill -f gha-rerun-daemon`. Tail: `tail -f ${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`.

## Scope (hardcoded in daemon)

- Repo: `forcedotcom/salesforcedx-vscode`
- Author: `@me` (must be `mshanemc`)
- State: `open` (incl. drafts)
- Excluded workflows: `End to End Tests`, `Apex End to End Tests`, `LSP End to End Tests`, `LWC End to End Tests` (redhat vscode-extension-tester)
- Max attempts: 4 (original + 3 reruns). `run_attempt >= 4` + failure → notify once per run-id.
- Poll: 60s

Change: edit `gha-rerun-daemon.sh` directly.

## State

Live from GitHub: `run_attempt`, `conclusion`, `status`. No disk state for rerun tracking.

Dedup: `/tmp/gha-rerun-notified.txt` (one run-id/line). Truncated at startup.

Log: `${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`. Truncated at startup.

## Design notes

- `run_attempt`: canonical GitHub rerun counter. `1`=original, `>= 4` = 3 reruns done.
- `gh run rerun <id> --failed` reruns only failed jobs, bumps `run_attempt`.
- Push to PR branch → fresh runs, new IDs, `run_attempt=1`.
- `pgrep -f gha-rerun-daemon` matches argv; no PID file.

## Stop

`pkill -f gha-rerun-daemon`

## Troubleshooting

- `gh: command not found` → install https://cli.github.com/
- `gh: HTTP 401` → `gh auth login`
- No notifications → System Settings → Notifications → terminal-notifier → allow.
- Not rerunning → `tail -f ${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`.
- Dies on Cursor quit — shouldn't (nohup+disown). Verify: `pgrep -f gha-rerun-daemon`.
