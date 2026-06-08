---
description: Iterating on Playwright tests
---

# Iterating Playwright Tests

Scratch org setup: see `references/local-setup.md`.

## sequence

1. run `web` locally (use `--retries 0`, follow debugging tips)
2. run `desktop` locally (use `--retries 0`)

**Passing args:** Use `--` to forward params to the underlying playwright command. Prefer file path over `--grep` (exact match, immune to title changes):
```bash
WIREIT_CACHE=none npm run test:web -w <package> -- --retries 0 test/playwright/specs/myTest.headless.spec.ts
WIREIT_CACHE=none npm run test:desktop -w <package> -- --retries 0 test/playwright/specs/myTest.headless.spec.ts
```
`WIREIT_CACHE=none` is always required when running a subset — wireit's cache key is based on input file fingerprints, not CLI args, so it serves the cached full-suite result otherwise.

**Port conflict (web):** If a previous web server is still on port 3001, playwright fails immediately with `http://localhost:3001 is already used`. Fix: `lsof -ti :3001 | xargs kill -9`

**Running from inside VS Code (agent shells):** When the shell inherits the VS Code extension host environment, `test:desktop` fails immediately with `Electron: bad option: --no-sandbox` / `--disable-workspace-trust` because `ELECTRON_RUN_AS_NODE=1` and `VSCODE_*` vars are set. Strip them on the command:

```bash
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE \
    -u VSCODE_PID -u VSCODE_IPC_HOOK -u VSCODE_NLS_CONFIG \
    -u VSCODE_HANDLES_UNCAUGHT_ERRORS -u VSCODE_CWD \
    -u VSCODE_CRASH_REPORTER_PROCESS_TYPE -u VSCODE_ESM_ENTRYPOINT \
    -u VSCODE_CLI -u VSCODE_CODE_CACHE_PATH -u VSCODE_L10N_BUNDLE_LOCATION \
    WIREIT_CACHE=none npm run test:desktop -w <package> -- --retries 0 <spec>
```

`unset` in a separate bash call won't help — each Bash tool invocation is a fresh shell.

3. edit github workflows if needed
4. CI (windows, gha) - see `analyze-e2e.md` for monitoring and analyzing results

After passing, clean up while keeping tests passing:

1. remove fallbacks, waits, "try another way"
2. align with `coding-playwright-tests.md` rules
3. consolidate locators, increase DRY/reuse
4. ensure playwright-ext exports are used by other extensions
5. verify compile/lint pass (`@.claude/skills/verification/`)

## Debugging

- Don't run `debug` mode unless instructed (pauses for human)
- Use @https://playwright.dev/docs/api/class-locator#locator-inner-html on known-good locator to get accurate inner locators
- Take screenshots (`read_file` tool) - review in `test-results` folder
- Capture HTML parent levels up from problem area to verify correct locators
- Use emojis infrequently

## useful reference

https://github.com/redhat-developer/vscode-extension-tester - pageObject/Selector patterns (selenium, not playwright, no web support, but informative)

## Things to ignore

**When analyzing failures, ignore these (expected, not errors):**

- TS extension activation: `Error: Activating extension 'vscode.typescript-language-features'`
- **All installed extensions temporarily disabled** (other extensions, not ours) - expected notification
- VS Code 1.116+ / `@vscode/test-electron`: `cannot change enablement of github copilot chat extension` — workbench Copilot Chat toggle in test env; non-critical (`helpers.ts` `NON_CRITICAL_ERROR_PATTERNS`)
- Bundled A4V (salesforcedx-einstein-gpt) JWT entitlement check failures — `Error creating JWT for`, `Unknown JWT Error identified`, `We couldn't access your Salesforce org` (E2E scratch orgs lack EGPT-for-developers entitlement); non-critical (`helpers.ts` `NON_CRITICAL_ERROR_PATTERNS`)
- `UtilityProcessWorker` — Electron utility process worker startup noise on macOS desktop tests (incidental, non-critical)
- `File Watcher (universal)` — File watcher system startup noise on macOS desktop tests (incidental, non-critical)
