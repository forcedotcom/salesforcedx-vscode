---
name: gha-rerun
description: Watch open PRs by mshanemc on forcedotcom/salesforcedx-vscode. Rerun failed GitHub Actions jobs up to 3x (GitHub run_attempt 1→4). Desktop-notify via terminal-notifier when maxed. Use when user says "gha-rerun", "watch my CI", "rerun my failed CI", "babysit my PRs", or similar.
model: haiku
---

# gha-rerun

Launch or manage a detached bash daemon that watches GitHub Actions runs for PRs authored by `@me` on `forcedotcom/salesforcedx-vscode` and auto-reruns failed jobs.

The daemon script lives alongside this file at `${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh`. Do not inline-rewrite it; just run it.

## Behavior per invocation

1. **Preflight dependencies**. All required:
   - `command -v gh` — error with `https://cli.github.com/`
   - `command -v jq` — error with `brew install jq`
   - `command -v terminal-notifier` — error with `brew install terminal-notifier`
   - `gh auth status` — if fails, instruct `gh auth login`

   If any missing, print the specific install command(s) and **stop** (do not spawn).

2. **Check for running daemon** via `pgrep -f gha-rerun-daemon`.
   - If a PID is returned: this is a **status invocation**. Do NOT spawn another.
     - Print: PID, uptime (`ps -o etime= -p <pid>`), last 30 lines of `${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`.
     - Print the currently-tracked open PRs by running the same `gh pr list` command the daemon uses.
     - Ask user: kill it? If yes → `pkill -f gha-rerun-daemon`.
     - Exit.
   - If no PID: continue to step 3.

3. **Ensure executable**: `chmod +x ${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh`. If the file is missing, error out with "daemon script missing at ${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh — reinstall the agent".

4. **Launch detached**:

   ```bash
   nohup ${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh </dev/null >/dev/null 2>&1 &
   disown
   ```

5. **Verify** it started: `sleep 1; pgrep -f gha-rerun-daemon` should return a PID. Print the PID, the log path (`${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`), and the notified-list path (`/tmp/gha-rerun-notified.txt`). Tell user how to stop (`pkill -f gha-rerun-daemon`) and how to tail logs (`tail -f ${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`).

## Scope (hardcoded in the daemon script)

- Repo: `forcedotcom/salesforcedx-vscode`
- Author: `@me` (the authenticated `gh` user — must be `mshanemc`)
- State: `open` (includes drafts)
- Workflow exclusions: `End to End Tests`, `Apex End to End Tests`, `LSP End to End Tests`, `LWC End to End Tests` (redhat vscode-extension-tester suite)
- Max attempts: 4 (original + 3 reruns). At `run_attempt >= 4` with failure → notify once per run-id.
- Poll interval: 60s

To change any of these, edit `${CLAUDE_PROJECT_DIR}/.claude/agents/gha-rerun-daemon.sh` directly.

## State

Live from GitHub: `run_attempt`, `conclusion`, `status` on each workflow run. No disk state for rerun tracking.

Notification dedup: `/tmp/gha-rerun-notified.txt`, one run-id per line. Truncated at daemon startup.

Log: `${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`, truncated at daemon startup.

## Design notes (context for the subagent, don't repeat to user)

- `run_attempt` is the canonical rerun counter from GitHub. `1`=original, `2`=after 1st rerun. `>= 4` means 3 reruns done.
- `gh run rerun <id> --failed` reruns only failed jobs within the run, preserving already-succeeded jobs. It bumps `run_attempt`.
- Every push to a PR branch creates fresh workflow runs with new IDs and `run_attempt=1`. New push = new chance naturally.
- `pgrep -f gha-rerun-daemon` matches the script path in argv; no PID file required.

## Stopping

`pkill -f gha-rerun-daemon`

## Troubleshooting

- **`gh: command not found`** — install https://cli.github.com/
- **`gh: HTTP 401`** — `gh auth login`
- **No notifications** — System Settings → Notifications → terminal-notifier → allow.
- **Daemon not rerunning** — tail log: `tail -f ${CLAUDE_PROJECT_DIR}/.claude/gha-rerun.log`.
- **Daemon dies on Cursor quit** — shouldn't (nohup + disown). Verify with `pgrep -f gha-rerun-daemon`.
