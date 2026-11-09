# W-24786649: Visualforce video-first Playwright spike

## Decision: do not proceed

The single approach tested was Playwright's native `page.screencast` recording, started after fixture setup. Review remediation fixed the local capture defects: new recordings show both hover cards, completion suggestions, and the saved file with the picker closed; web recordings fill the frame. CI uploads remain unverified. This spike is still unsuccessful; stop here. No follow-on work items were defined or created.

## Changes

- Removed all spec-authored screenshot capture calls from `visualforceLsp.headless.spec.ts` and `visualforceTemplates.headless.spec.ts` (six captures across four tests). Existing assertions remain.
- Moved their duplicated setup into the automatic recording fixture in `packages/salesforcedx-vscode-visualforce/test/playwright/fixtures/index.ts`: console/network monitoring, workbench readiness, welcome-tab cleanup, secondary-sidebar cleanup, then workspace readiness.
- Start recording only after those operations. The test body, including LSP file creation and template wizards, runs inside the recording. Stop and attach `Visualforce flow` (`video/webm`) in fixture teardown, before the desktop fixture closes/kills Electron. Passing recordings are retained too.
- Disable automatic web video and opt Visualforce out of launch-time Electron video through the new `createDesktopTest({ recordVideo: false })` option. Other desktop consumers keep their existing default.
- Disable trace screencast screenshots for Visualforce so an earlier trace does not control the flow recording's frame size or supply a cached setup frame. Trace actions/DOM snapshots and runner-authored diagnostic screenshots remain configured.
- No workflow changes: the existing Visualforce workflow already uploads the HTML report and `test-results` for every lane, including these attachments.

API reference: [Screencast.start/stop](https://playwright.dev/docs/api/class-screencast). Installed and tested Playwright version: 1.64.1.

## Initial local verification

Executed in this checkout on 2026-11-05, Node 24.20.0, macOS arm64. Dependencies installed with `pnpm install --frozen-lockfile`.

| Command | Result |
| --- | --- |
| `pnpm --filter salesforcedx-vscode-visualforce test:web -- --retries 0` | 4 passed; 14.7s |
| `E2E_FROM_VSIX=1 pnpm --filter salesforcedx-vscode-visualforce test:desktop -- --retries 0` | 4 passed; 44.5s; VS Code 1.145.1 |
| `pnpm --filter salesforcedx-vscode-visualforce test:compile` | Passed |
| `pnpm --filter salesforcedx-vscode-visualforce lint` | Passed |
| `pnpm --filter @salesforce/playwright-vscode-ext lint` | Passed with one `require-await` warning in unchanged `src/utils/helpers.ts` |
| `pnpm --filter @salesforce/playwright-vscode-ext test` | 84 passed |
| Prettier check of changed TypeScript; `git diff --check` | Passed |
| `pnpm run check:dupes` | Failed: 151 clones, 1.63% vs 0% threshold; no reported clone in a changed file |

### Initial recordings (superseded by remediation below)

Evidence is local, gitignored, and **not CI evidence**:

- `.e2e-artifacts/sm-W-24786649/local-web/`
- `.e2e-artifacts/sm-W-24786649/local-desktop/`

Each contains the copied `test-results/`, `playwright-report/`, and decoded review images in `frames/`. Videos are `test-results/<test-name>/visualforce-flow.webm`; report attachments are also present under each test's `attachments/` directory.

Decoded both HTML report manifests: each of the eight test results references exactly one `video/webm` attachment, and every referenced file exists in its report's `data/` directory. This verifies local report packaging, not GitHub artifact upload.

`ffprobe` confirmed VP9, 1920×1080 for web, and 1920×1080 for desktop. Video durations:

| Flow | Web | Desktop |
| --- | --- | --- |
| Apex tag completion | 4.16s | 11.28s |
| Mixed-case Apex tag hover | 3.20s | 11.36s |
| Create Visualforce Page | 7.20s | 11.16s |
| Create Visualforce Component | 7.04s | 11.08s |

Review method: decoded chronological contact sheets at 5 fps (web) and 3 fps (desktop), plus full-size final frames for completion, hover, and page creation. This was frame inspection, not full interactive playback; it does not establish every transient state was captured.

Observed on both platforms: recordings begin at an already-open workbench, with no welcome-tab/sidebar setup sequence. They show file creation, typing, command palettes, and template generation. The generated page and companion metadata file are visible at the end of the page-creation recording.

Initial capture defects (fixed below):

1. The desktop completion video's final frame still shows the `File: Save` command picker and a dirty editor, despite the test passing its saved-editor assertion. The final asserted UI state is not demonstrated by that recording.
2. The sampled hover frames and full-size final hover frames do not show the asserted hover cards on either platform. Complete hover evidence could not be confirmed. Passing DOM assertions alone are insufficient to certify the recording.
3. Web recordings contain a 1280×720 workbench padded inside the 1920×1080 video. The shared web config's project-level Desktop Chrome device viewport overrides its top-level viewport setting. Desktop recordings fill their frame.

No alternative recorder, screenshot replacement, arbitrary delay, or post-processing workaround was implemented.

## Review remediation

- Added `waitForVideoFrame` to the recording fixture. After suggestion/hover assertions and before finalization, wait for `screencast.onFrame` to receive a frame whose presentation timestamp is at least the assertion time. This prevents the next action or teardown from outrunning rendering; it is not a fixed sleep.
- Fixed the save assertion: the unsaved marker is on the file tab, not `.monaco-editor`. Assert that the tab is dirty before Save, the picker closes, and that same tab loses its dirty marker afterward.
- Override the web project's Desktop Chrome viewport with the shared 1920×1080 viewport, eliminating the padded 1280×720 workbench.

Re-executed in this checkout on 2026-11-05 after `pnpm install --frozen-lockfile`:

| Command | Result |
| --- | --- |
| `pnpm --filter salesforcedx-vscode-visualforce test:web -- --retries 0` | 4 passed; 12.3s |
| `E2E_FROM_VSIX=1 pnpm --filter salesforcedx-vscode-visualforce test:desktop -- --retries 0` | 4 passed; 27.3s; macOS, VS Code 1.145.1 |
| `pnpm --filter salesforcedx-vscode-visualforce test:compile` | Passed |
| `pnpm --filter salesforcedx-vscode-visualforce lint` | Passed |
| Prettier check of the three remediation TypeScript files; `git diff --check` | Passed |
| `pnpm run check:dupes` | Failed: 151 clones, 1.63% vs 0% threshold; no reported clone in a changed file |

New evidence: `.e2e-artifacts/sm-W-24786649/remediated-web/` and `remediated-desktop/`. Original evidence remains untouched. Each new HTML report references exactly one existing `video/webm` attachment per test.

Played all eight recordings from start to `ended` at normal speed in Chromium. `playback.json` in each evidence directory records the presented frame counts, which match `ffprobe` decoded frame counts. All are VP9, 1920×1080. Visual inspection used chronological contact sheets across each complete recording with near-duplicate frames removed (`mpdecimate`), plus full-size completion/hover final frames. This is programmatic playback plus frame inspection, not a claim of human interactive playback; source videos were not edited.

| Flow | Web duration / frames | macOS duration / frames |
| --- | --- | --- |
| Apex tag completion | 4.72s / 118 | 12.04s / 301 |
| Mixed-case Apex tag hover | 3.92s / 98 | 11.92s / 298 |
| Create Visualforce Page | 7.44s / 186 | 13.00s / 325 |
| Create Visualforce Component | 7.44s / 186 | 13.36s / 334 |

Both platforms now visibly show suggestions, insertion, a clean saved tab with no Save picker, both original-case hover cards, and template generation through the created file and companion metadata in Explorer. Web workbenches fill the video frame. Local capture defects are fixed; local evidence still does not establish CI upload or Windows behavior.

## CI proof and constraints

`.github/workflows/visualforceE2E.yml` invokes `.github/actions/playwright-e2e/action.yml`. Source inspection confirms `if: always()` uploads of report/results directories, with 14-day retention:

- `playwright-report-visualforce-web` / `playwright-test-results-visualforce-web`
- `playwright-report-visualforce-desktop-macos-latest` / `playwright-test-results-visualforce-desktop-macos-latest`
- `playwright-report-visualforce-desktop-windows-latest` / `playwright-test-results-visualforce-desktop-windows-latest`

Rechecked during remediation: `gh run list --repo forcedotcom/salesforcedx-vscode --branch sm/W-24786649 --limit 10 --json databaseId,status,conclusion,workflowName,headSha` returned `[]`. No run of these uncommitted changes was available. The no-commit/no-push constraint prevents publishing them for CI execution; dispatching an existing remote revision would not test these changes. Consequently, actual upload, downloaded-video review, Windows behavior, and CI-specific Electron teardown remain unverified. Local passing recordings are not substituted for that proof. Resolving this blocker requires an authorized publication of these changes, running the Visualforce workflow, downloading all three lanes' artifacts, and reviewing their recordings before reconsidering rollout.

Setup failures intentionally have no flow video because recording has not started. Failure-path video finalization was not separately exercised. These limitations and absent CI proof preclude rollout to the remaining extensions.
