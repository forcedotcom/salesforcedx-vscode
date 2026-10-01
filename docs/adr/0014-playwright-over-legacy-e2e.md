# E2E tests use Playwright, not the legacy RedHat/WDIO harness

New end-to-end tests live in each extension's `test/playwright` directory and run via Playwright. The legacy RedHat `vscode-extension-tester` (WDIO) suite under `packages/salesforcedx-vscode-automation-tests` was removed (W-22973849). See [contributing/tests.md](../../contributing/tests.md) and the [playwright-e2e skill](../../.claude/skills/playwright-e2e/SKILL.md).
