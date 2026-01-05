goal: get e2e tests for metadata passing on windows in github actionsthere's somethign wrong with the tests, only on windows.

## boundaries

you may not disable tests on windowsyou may not change any code in /src foldersyou **should** edit the playwright ext if there are problems.

## Iterating Playwright Tests Rules

### sequence

1. get a test to run for `web` locally by following "debugging" suggestions
2. make sure it runs on desktop (locally, which is a mac)
3. make the commit, push to github
4. monitor the CI e2e runs using the gh cli https://github.com/forcedotcom/salesforcedx-vscode/pulls
5. make sure it passes on web, windows and mac.

Once everything is pasing, let's clean up while keeping it that way by running the tests locally after each change.

1. removing fallbacks, waits, and "try another way"
2. very carefully aligning with `coding-playwright-tests.mdc` rules
3. consolidating locators and increasing DRY/code reuse
4. make sure everything exported from playwright-ext is used by some other ext.
5. making sure compile,lint,etc still pass (follow `test-your-changes.mdc`)
6. make sure the tests are still passing on gha

### Debugging

LLMs should not run `debug` mode playwright tests unless instructed to. Those pause and requier the human to step through.Use @https://playwright.dev/docs/api/class-locator#locator-inner-html on a known-good locator and use the result to get more accurate locators for stuff inside it.Take screenshots and review them (tool call `read_file`) for additional context. If an step is unclear (why it's failing) take lots of screenshots. Always review the screenshots. They show up in `test-results` folder of the extension under test.Capture html "parent" levels up from where you are having a problem and study it to make sure you are using correct locators.Use emojis infrequently.Read the playwright docsuse https://github.com/redhat-developer/vscode-extension-tester for pageObject/Selector stuff. It's selenium (not playwright) and does not support web extensions, but might be informative.