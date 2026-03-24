---
description: Iterating on Playwright tests
---

# Iterating Playwright Tests

Scratch org setup: see `references/local-setup.md`.

## sequence

1. run `web` locally (use `--retries 0`, follow debugging tips)
2. run `desktop` locally (use `--retries 0`)

**Passing args:** Use `--` to forward params to the underlying command, e.g. `npm run test:web -w <package> -- --retries 0` or `npm run test:desktop -w <package> -- --retries 0` 3. edit github workflows if needed 4. CI (windows, gha) - see `analyze-e2e.md` for monitoring and analyzing results

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
