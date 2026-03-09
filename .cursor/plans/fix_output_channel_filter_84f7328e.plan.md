---
name: Fix Output Channel Filter
overview: Fix the output channel filter interaction in playwright-vscode-ext so waitForOutputChannelText reliably finds text in virtualized output, and add a dedicated E2E test proving the filter works.
todos:
  - id: filter-test
    content: Add 'should filter output channel content' test to outputChannel.headless.spec.ts that proves filter narrows content and clear restores it
    status: completed
  - id: scope-locator
    content: Scope filterInput locator to output panel instead of page-wide getByPlaceholder
    status: completed
  - id: fix-interaction
    content: 'Fix filter interaction: focus before fill, press Enter on input not page, wait for re-render'
    status: completed
  - id: run-playwright-ext-tests
    content: Run playwright-vscode-ext test:web and test:desktop to verify filter test passes
    status: completed
  - id: verify-downstream
    content: Run apex-testing specs (runApexTestsCommandPalette, apexTestSuite) to confirm waitForOutputChannelText works without scrolling
    status: completed
isProject: false
---

# Fix Output Channel Filter for Playwright E2E

## Problem

`waitForOutputChannelText` fills the output panel filter input and presses Enter, then reads `.view-lines` via `textContent()`. The filter is "in the panel but out of reach" -- tests that wait for `=== Test Results` only pass when the user scrolls manually (which brings lines into the virtualized DOM).

## Key Finding: The Filter Should Work

VS Code's output panel filter uses Monaco's `setHiddenAreas` API ([source](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/output/browser/outputView.ts)). When a filter is active:

- Non-matching lines are added to hidden areas and excluded from the view model
- Only matching lines are rendered in `.view-lines`
- `.view-lines textContent()` should return only the matching lines

This means the current approach of "fill filter, read `.view-lines`" is architecturally correct. The problem is that the filter is not being reliably applied.

## Past Context (from chat history)

- [Output channel filter analysis](a4fd94ac-08a2-4503-b57f-e141263e1838): Main analysis of the problem. Filter present but unusable. Clipboard rejected.
- [apex-log executeAnonymous E2E](7d9c3d13-34c3-44b3-b946-181ffbbf0c37): Workaround used: assert on `debug.log` tab instead of output channel. Timeout at `outputChannel.ts:72` waiting for output text.
- [executeAnonymous debug.log change](ac53190b-cfa4-4d64-b8e8-3407e722e3b0): Explains virtualized output and why `debug.log` was used instead.
- [SObject Refresh test failures](cc3fecd5-65b5-4c05-a8a8-139fc84836cd): Uses `waitForOutputChannelText`; failure due to command error, not filter.

## Evolution of the filter code (git history)

| Commit    | Approach                                                                                       | Issue                                                      |
| --------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| d11dc9f21 | `getByPlaceholder(/Filter/i)`, `fill()` + `waitForTimeout(500)`                                | No visibility check, no Enter, hardcoded delay             |
| 820a5fe7a | Same + `Control+A, Backspace` to clear                                                         | Keyboard clear unreliable                                  |
| 4d61ddd69 | `ensureOutputFilterReady` (hover tab, wait visible), `withOutputFilter` with Enter             | Better, but still used `getAllOutputText` on `.view-lines` |
| f9bcfccd3 | Placeholder `/Filter \(e\.g\./i`, `waitForOutputChannelTextCommon` with clear/fill/Enter cycle | Current version. Retries with `.toPass()`                  |

## Rejected Approaches

- **Clipboard (select-all + copy)**: User explicitly rejected
- **Monaco model via `page.evaluate()`**: VS Code does not expose `window.monaco`; no way to call `editor.getModel().getValue()`
- **Accessibility APIs**: No standard way to expose full virtualized content

## Diagnosis Plan

The filter mechanism is sound (setHiddenAreas), so the failure is in the Playwright interaction. Likely suspects:

1. **Filter input not focused**: `fill()` with `force: true` bypasses actionability checks. The filter input may not actually receive the value if it's behind an overlay or not properly attached.
2. **Enter not triggering filter application**: VS Code may require the input to have focus (not just a value) before Enter applies.
3. **Wrong filter input**: `getByPlaceholder(/Filter \(e\.g\./i).first()` might match a different filter input (Debug Console, Problems panel, etc.) if multiple panels are open.
4. **Timing**: `.view-lines` read immediately after Enter, before VS Code re-renders with hidden areas.

## Implementation Plan

### Step 1: Write a dedicated filter test in `outputChannel.headless.spec.ts`

Add a test `'should filter output channel content'` that:

1. Opens output panel, selects a high-volume built-in channel (e.g. "Extension Host" or "Log (Extension Host)") that produces hundreds of lines at startup without loading our extensions -- isolates the filter from any Salesforce-specific behavior
2. Waits for content to exceed the viewport (enough lines that virtualization kicks in)
3. Reads unfiltered `.view-lines` content (screenshot + text capture + line count)
4. Fills the filter with a specific string known to be in the output (e.g. a common log prefix)
5. Presses Enter
6. Waits briefly for re-render
7. Reads filtered content -- asserts it contains the filter text
8. Asserts filtered content is shorter than unfiltered (proving lines were hidden by `setHiddenAreas`)
9. Clears the filter
10. Asserts content is restored (line count returns to original)

This test will fail initially. That's expected -- it proves the filter isn't working and gives us a repro.

### Step 2: Debug the filter interaction

Instrument `waitForOutputChannelTextCommon` (or the test) with:

- Screenshot before/after each step (fill, Enter, read)
- Log the filter input's bounding box, visibility, and value at each step
- Scope the filter input locator to the output panel specifically (not page-wide)
- Try `input.focus()` before `fill()` instead of `click({ force: true })`
- Try `input.press('Enter')` instead of `page.keyboard.press('Enter')`

Key change to try: **scope `filterInput` to the output panel**:

```typescript
// Current (page-wide, may match wrong input):
const filterInput = (page: Page) => page.getByPlaceholder(/Filter \(e\.g\./i).first();

// Proposed (scoped to output panel):
const filterInput = (page: Page) =>
  outputPanel(page)
    .getByPlaceholder(/Filter \(e\.g\./i)
    .first();
```

### Step 3: Fix the filter interaction

Based on diagnosis, likely fixes:

- **Scope the locator** to output panel (see above)
- **Focus before fill**: `await input.focus(); await input.fill(text);` instead of `fill({ force: true })`
- **Press Enter on the input**, not the page: `await input.press('Enter');`
- **Wait for re-render** after Enter: add a brief `expect().toPass()` or poll for `.view-lines` content change
- **Verify filter is applied** before reading: check that `.view-lines` content changed after filter

### Step 4: Make the test prove it

The test from Step 1 should now pass, proving:

- Filter input receives text
- Enter triggers `setHiddenAreas`
- `.view-lines` reflects only matching lines
- Clear restores full content

### Step 5: Verify downstream consumers

Run the apex-testing specs that use `waitForOutputChannelText` with `=== Test Results` to confirm they pass without manual scrolling:

- `runApexTestsCommandPalette.headless.spec.ts`
- `apexTestSuite.headless.spec.ts`

## Files to modify

- [outputChannel.ts](packages/playwright-vscode-ext/src/pages/outputChannel.ts): Fix `filterInput` scoping, `ensureOutputFilterReady`, `waitForOutputChannelTextCommon`
- [outputChannel.headless.spec.ts](packages/playwright-vscode-ext/test/playwright/specs/outputChannel.headless.spec.ts): Add filter test

## Verification

Per verification skill: compile (`npm run compile -w @salesforce/playwright-vscode-ext`), lint, then run `npm run test:web -w @salesforce/playwright-vscode-ext -- --retries 0` and `npm run test:desktop -w @salesforce/playwright-vscode-ext -- --retries 0`.
