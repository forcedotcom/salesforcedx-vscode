---
active: true
iteration: 8
max_iterations: 30
completion_promise: "WINDOWS_E2E_COMPLETE"
started_at: "2026-01-05T17:00:00Z"
---

**GOAL**: Get e2e tests for metadata passing on Windows in GitHub Actions. Tests are currently failing only on Windows.

**BOUNDARIES**:
- You may NOT disable tests on Windows
- You may NOT change any code in /src folders
- You SHOULD edit the playwright ext if there are problems

**ITERATING PLAYWRIGHT TESTS RULES**:

**Sequence**:
1. Get a test to run for web locally by following "debugging" suggestions
2. Make sure it runs on desktop (locally, which is a Mac)
3. Make the commit, push to GitHub
4. Monitor the CI e2e runs using the gh CLI: https://github.com/forcedotcom/salesforcedx-vscode/pulls
5. Make sure it passes on web, Windows and Mac
6. Once everything is passing, let's clean up while keeping it that way by running the tests locally after each change:
   - Removing fallbacks, waits, and "try another way" patterns
   - Very carefully aligning with coding-playwright-tests.mdc rules
   - Consolidating locators and increasing DRY/code reuse
   - Make sure everything exported from playwright-ext is used by some other ext
   - Making sure compile, lint, etc still pass (follow test-your-changes.mdc)
   - Make sure the tests are still passing on GHA

**DEBUGGING**:
- LLMs should not run debug mode playwright tests unless instructed to (those pause and require human to step through)
- Use innerHtml on a known-good locator and use the result to get more accurate locators for stuff inside it
- Take screenshots and review them (tool call read_file) for additional context. If a step is unclear (why it's failing) take lots of screenshots. Always review the screenshots. They show up in test-results folder of the extension under test
- Capture HTML "parent" levels up from where you are having a problem and study it to make sure you are using correct locators
- Use emojis infrequently
- Read the playwright docs
- Use https://github.com/redhat-developer/vscode-extension-tester for pageObject/Selector stuff. It's selenium (not playwright) and does not support web extensions, but might be informative. Clone the repo or use GitHub search.

Output <promise>WINDOWS_E2E_COMPLETE</promise> when all Windows e2e tests for metadata are passing in GitHub Actions on all platforms (web, Windows, Mac).
