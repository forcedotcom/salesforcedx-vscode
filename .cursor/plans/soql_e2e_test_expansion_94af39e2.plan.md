---
name: SOQL E2E Test Expansion
overview: 'Add two new spec files covering all five requested SOQL test scenarios: builder view query construction and execution (including no-default-org state), and text editor code lens / command palette / selected-text flows.'
todos:
  - id: file1-builder
    content: 'Create soqlBuilderBuildAndRun.spec.ts: no-org step first (verify warning banner + hidden buttons/dropdowns), then setupMinimalOrgAndAuth, build-a-query step (From → Account, Fields → Id+Name, query preview assertion), Run Query step (verify SOQL Query Results tab), and Get Query Plan step (verify SOQL output channel)'
    status: completed
  - id: file2-texteditor
    content: Create soqlTextEditorRun.spec.ts with text editor setup (create .soql file via soql_open_new_text_editor, type query, save), Run Query code lens step, Get Query Plan code lens step, Execute with Current File step, Get Plan with Current File step, Execute with Selected Text step, Get Plan with Selected Text step
    status: completed
  - id: output-channel-clear
    content: Add clearOutputChannel() calls between each run/plan step to avoid stale text matches in waitForOutputChannelText
    status: completed
  - id: verify-nls-keys
    content: Confirm all four NLS keys (data_query_document_text, query_plan_document_text, data_query_selection_text, query_plan_selection_text) are exported from package.nls.json and use them instead of hardcoded strings
    status: completed
  - id: webview-selector-validation
    content: After initial implementation, run locally to validate iframe selector ('iframe.webview.ready' + '#active-frame') and LWC element selectors work; adjust if needed
    status: completed
isProject: false
---

# SOQL E2E Test Expansion

## Architecture

The five features split naturally into two new spec files (one test per file per the coding guide):

- [`soqlBuilderBuildAndRun.spec.ts`](packages/salesforcedx-vscode-soql/test/playwright/specs/soqlBuilderBuildAndRun.spec.ts) — Builder View (features 1 & 2, plus no-default-org check)
- [`soqlTextEditorRun.spec.ts`](packages/salesforcedx-vscode-soql/test/playwright/specs/soqlTextEditorRun.spec.ts) — Text Editor (features 3, 4, 5)

Both files live alongside the existing [`soqlBuilder.spec.ts`](packages/salesforcedx-vscode-soql/test/playwright/specs/soqlBuilder.spec.ts) and use the same fixture/import structure.

---

## Key Technical Facts

**Output channel name:** `"SOQL"` (from `package.json` `displayName`)

**Webview access** (builder tests only):

```typescript
const soqlFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');
```

Playwright v1.14+ automatically pierces LWC's open shadow DOM, so standard `locator()` calls work inside `soqlFrame`.

**API quick pick:** Only shown for code-lens / command-palette "Run Query" paths. Builder webview "Run Query" and all "Get Query Plan" paths use REST directly (no picker).

**Code lens rendering:** Appear as `<a role="link">` elements at the top of the Monaco editor.

**No-default-org UI:** When no org is set, the builder renders a blue banner (`div.info-notification__message`) with text starting `"No default org found."`. The header buttons (`button.run-button`, `button.query-plan-button`) and the entire form (From, Fields, Filter, Order By, Limit) are absent from the DOM. The query preview is still visible.

---

## File 1: `soqlBuilderBuildAndRun.spec.ts` (Features 1 & 2 + No-Org Check)

### Overall test flow

The test uses `waitForExtensionsActivated` **without** calling `setupMinimalOrgAndAuth` first, opens the builder, checks the no-org state, then sets up the org and proceeds with building and running a query.

### Step: open builder (no org yet)

```typescript
await waitForExtensionsActivated(page);
await ensureSecondarySideBarHidden(page);
await executeCommandWithCommandPalette(page, packageNls.soql_open_new_builder);
// name file → pick directory (same quick-input pattern as existing test)
const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlFile.soql' });
await expect(soqlTab).toBeVisible({ timeout: 20_000 });

const soqlFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');
```

### Step: verify no-default-org state

```typescript
// Blue warning banner is visible
await expect(soqlFrame.locator('div.info-notification__message'), 'blue no-org banner should be visible').toBeVisible({
  timeout: 10_000
});
await expect(
  soqlFrame.locator('div.info-notification__message'),
  'banner should say "No default org found"'
).toContainText('No default org found.');

// Run Query and Get Query Plan buttons are absent
await expect(
  soqlFrame.locator('button.run-button'),
  'Run Query button should be hidden with no org'
).not.toBeAttached();
await expect(
  soqlFrame.locator('button.query-plan-button'),
  'Get Query Plan button should be hidden with no org'
).not.toBeAttached();

// From / Fields dropdowns are absent
await expect(
  soqlFrame.getByPlaceholder('Search object...'),
  'From dropdown should be hidden with no org'
).not.toBeAttached();
await expect(
  soqlFrame.getByPlaceholder('Search fields...'),
  'Fields dropdown should be hidden with no org'
).not.toBeAttached();
```

### Step: set up org and verify UI restores

```typescript
await setupMinimalOrgAndAuth(page);

// Warning banner is gone
await expect(
  soqlFrame.locator('div.info-notification__message'),
  'blue no-org banner should disappear after org is set'
).not.toBeAttached({ timeout: 15_000 });

// Buttons and dropdowns are now visible
await expect(soqlFrame.locator('button.run-button'), 'Run Query button should appear').toBeVisible();
await expect(soqlFrame.locator('button.query-plan-button'), 'Get Query Plan button should appear').toBeVisible();
await expect(soqlFrame.getByPlaceholder('Search object...'), 'From dropdown should appear').toBeVisible();
```

### Step: Build a query (Feature 1)

After the `.soql` tab appears:

```typescript
const soqlFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');

// Select sObject
await soqlFrame.getByPlaceholder('Search object...').click();
await soqlFrame.getByPlaceholder('Search object...').fill('Account');
await soqlFrame.locator('p.option[data-option-value="Account"]').click();

// Select fields
await soqlFrame.getByPlaceholder('Search fields...').first().click();
await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Id"]').click();
await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Name"]').click();

// Verify query preview
await expect(soqlFrame.locator('.query-preview-container pre'), 'query preview should show built SOQL').toContainText(
  'SELECT Id, Name FROM Account'
);
```

### Step: Run Query from Builder (Feature 2)

```typescript
await soqlFrame.getByRole('button', { name: 'Run Query' }).click();
// No API picker — builder always uses REST
// Verify SOQL Query Results panel opens
const resultsTab = page.locator('[role="tab"]').filter({ hasText: 'SOQL Query Results' });
await expect(resultsTab, 'SOQL Query Results tab should appear').toBeVisible({ timeout: 30_000 });
```

### Step: Get Query Plan from Builder (Feature 2)

```typescript
await soqlFrame.getByRole('button', { name: 'Get Query Plan' }).click();
// Verify via output channel
await ensureOutputPanelOpen(page);
await selectOutputChannel(page, 'SOQL');
await waitForOutputChannelText(page, { expectedText: 'Query plan', timeout: 30_000 });
```

---

## File 2: `soqlTextEditorRun.spec.ts` (Features 3, 4, 5)

### Setup

Same org setup as above. Create a `.soql` file in text editor mode:

```typescript
await executeCommandWithCommandPalette(page, packageNls.soql_open_new_text_editor);
// name the file → pick directory (same pattern as existing test)
// Type a valid query into the editor
await page.keyboard.type('SELECT Id, Name FROM Account LIMIT 10');
await page.keyboard.press('Control+s');
```

### Helper: select API (REST)

Used only by "Run Query" flows — reused across multiple steps:

```typescript
await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
await page.keyboard.press('Enter'); // selects "REST API"
```

### Helper: verify query output

```typescript
await ensureOutputPanelOpen(page);
await selectOutputChannel(page, 'SOQL');
await waitForOutputChannelText(page, { expectedText: 'records', timeout: 30_000 });
```

### Step: Run Query code lens (Feature 3)

```typescript
const runQueryLens = page.getByRole('link', { name: 'Run Query' });
await expect(runQueryLens, 'Run Query code lens should be visible').toBeVisible({ timeout: 15_000 });
await runQueryLens.click();
// API picker appears → select REST API
// Verify output channel
```

### Step: Get Query Plan code lens (Feature 3)

```typescript
const planLens = page.getByRole('link', { name: 'Get Query Plan' });
await planLens.click();
// No API picker
// Verify output channel contains plan data
```

### Step: Run Query with Current File (Feature 4)

```typescript
await executeCommandWithCommandPalette(page, packageNls.data_query_document_text);
// API picker → select REST
// Verify output channel
```

### Step: Get Query Plan with Current File (Feature 4)

```typescript
await executeCommandWithCommandPalette(page, packageNls.query_plan_document_text);
// No API picker
// Verify output channel
```

### Step: Run Query with Selected Text (Feature 5)

```typescript
await page.keyboard.press('Control+a'); // select all
await executeCommandWithCommandPalette(page, packageNls.data_query_selection_text);
// API picker → select REST
// Verify output channel
```

### Step: Get Query Plan with Selected Text (Feature 5)

```typescript
await page.keyboard.press('Control+a'); // select all
await executeCommandWithCommandPalette(page, packageNls.query_plan_selection_text);
// No API picker
// Verify output channel
```

---

## Risks / Notes

- **Webview iframe access is new in this repo.** The `frameLocator('iframe.webview.ready').frameLocator('#active-frame')` pattern is untested here; we may need to adjust the iframe selector after running locally.
- **LWC shadow DOM:** Playwright auto-pierces open shadow DOM, but if selectors inside the webview fail, fallback to `soqlFrame.locator('...')` using the `data-el-*` attributes (e.g. `[data-el-chevron]`).
- **Code lens visibility:** Code lenses only appear once the file is non-empty and a default org is set; ensure the editor is active and file is saved before locating them.
- **`clearOutputChannel`** between steps ensures `waitForOutputChannelText` checks fresh output, not previous runs.
- All NLS keys (`data_query_document_text`, `query_plan_document_text`, `data_query_selection_text`, `query_plan_selection_text`) are confirmed present in `package.nls.json`.
