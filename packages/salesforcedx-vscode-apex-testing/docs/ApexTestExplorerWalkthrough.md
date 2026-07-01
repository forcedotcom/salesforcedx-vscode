# Apex Test Explorer walkthrough

**In VS Code:** Command Palette → **SFDX: Open Apex Test Explorer Walkthrough** (or **Help → Welcome → Walkthroughs** when a Salesforce project is open).

Use the **Testing** view (flask icon) with the **Apex Tests** controller. You need a Salesforce project, default org authorized, and the Apex Testing extension active. Tests are discovered from the org (Tooling API); refresh after deploys or org changes.

## See tests available in the org

1. Open **View → Testing** (or the Testing activity bar).
2. Under **Apex Tests**, wait for discovery to finish (or click **Refresh** on the test controller).
3. Tree layout:
   - **Apex Test Suites** — named suites from the org (expand to load member classes).
   - **Namespaces** → **packages** (unpackaged, 1GP, 2GP) → **test classes** → **@Test methods**.

Classes that exist only in the org (not on disk) still appear; they open in a read-only org view when you use **Go to Test**.

## Run tests from an Apex test class

- Expand to the class, then use **Run Test** on the class row (runs all `@IsTest` methods in that class).
- Or right-click the class → run/debug.
- The Testing toolbar **Run** button uses the **default** run profile. With nothing specific selected, that profile runs **in-workspace** tests only (classes that map to files in your workspace). To run the entire org, open the run profile dropdown (chevron next to **Run**) and pick the secondary profile **SFDX: Run All Apex Tests in Org**—use that intentionally on large orgs.

## Run a specific test from a test class

1. Expand the class until you see individual methods (`MyClass.myTestMethod`).
2. Click **Run Test** (or **Debug Test**) on that method only.

## View and run Apex test suites

1. At the top of **Apex Tests**, open **Apex Test Suites**.
2. Expand a suite once; the extension loads the classes in that suite.
3. **Run Test** on the suite row to run all tests in the suite.

Suites cannot be **debugged** as a whole—debug individual classes or methods instead.

## Filter by tag, text, or exclude (`!`)

Use the **filter** box on the Testing view:

| What you want           | How                                                                     |
| ----------------------- | ----------------------------------------------------------------------- |
| Name contains text      | Type a substring (e.g. `AccountService`).                               |
| In-workspace tests only | `@in-workspace` (Apex/LWC tests mapping to local project files).        |
| Org-only tests          | `@org-only` (deployed to org, not present locally).                     |
| Suites only             | `@test-suite`                                                           |
| Stale tests             | `@stale` (results restored from previous session or code changed since last run). |
| Exclude matches         | Prefix with `!` (e.g. `!@org-only` or `!Heavy` to hide matching items). |

Combine as needed for your VS Code version’s filter rules.

When a filter narrows what you see, VS Code may pass only the **visible** tests in the run request for the default profile’s toolbar **Run**, so that subset runs instead of every in-workspace test. The secondary profile **SFDX: Run All Apex Tests in Org** (dropdown) always runs the full org regardless of filter. Use **Re-run Stale** profiles to run only outdated tests.

## See results in the Test Results tab

After a run:

- Pass/fail icons update on the tree; expand failed items for messages/stack traces.
- Open the **Test Results** panel (from the run notification or Testing UI) for the full run output, failures, and timing.
- With **concise** results enabled (`salesforcedx-vscode-apex-testing.test-run-concise`), the UI emphasizes failures.

Re-running clears prior result decorations until the new run completes; use **Refresh** on the controller if the tree looks out of sync with the org.

## Stale results, sessions, and refresh

Results are stored on disk and persist across sessions. On load or **Refresh**, recent results (< 24 hours) are restored:

- **Pre-session results** appear dimmed and tagged `@stale` — not run this session.
- **Current-session results** appear at full brightness — run since IDE opened.

Running a test removes its `@stale` tag and restores full brightness. Use the **Re-run Stale** run profiles to re-execute only outdated tests.

Disable restoration via setting: `salesforcedx-vscode-apex-testing.restore-previous-results`.

## Deploy changes and test freshness

When you deploy an Apex class containing tests, the extension detects the change and marks all methods in that class as `@stale`. This happens automatically — no refresh needed.

The dimmed appearance and `@stale` tag signal code changed since the test last ran. Run affected tests (or use **Re-run Stale In-Workspace Tests**) to validate deployed changes.

## Clear test results and history

Test Explorer's built-in **Clear All Results** (`...` menu) removes pass/fail icons from tree but keeps result files on disk — subsequent **Refresh** restores them.

To permanently remove stored results, run **SFDX: Clear Apex Test Results** from Command Palette. This deletes result files so they won't be restored on refresh or reload.

## Add or remove tests in a suite

- **Add tests:** Command Palette → **SFDX: Add Tests to Apex Test Suite**, pick suite, multi-select classes to add
- **Remove tests:** Command Palette → **SFDX: Remove Tests from Apex Test Suite**, pick suite, multi-select classes to remove (suite must have existing members)

Suite operations use the org (Tooling API); changes persist after refresh.

## Related commands

From the Command Palette: **Run Apex Tests**, **Run Apex Test Class**, **Run Apex Test Method**, **Run Apex Test Suite**, **Clear Apex Test Results**, plus suite create/add/remove. The explorer is the main place to browse, filter, and pick what to run.
