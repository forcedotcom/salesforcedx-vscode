# Apex Test Explorer walkthrough

**In VS Code:** Command Palette → **SFDX: Open Apex Test Explorer Walkthrough** (or **Help → Welcome → Walkthroughs** when a Salesforce project is open).

Use the **Testing** view (flask icon) with the **Apex Tests** controller. You need a Salesforce project, default org authorized, and the Apex Testing extension active. Tests are discovered from the org (Tooling API); refresh after deploys or org changes. Some metadata operations, including a successful **Delete from Project and Org**, trigger this refresh automatically.

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
- **Run All Tests in Org** (default run profile) runs everything when nothing specific is selected—use with care on large orgs.

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
| In-workspace tests only | `@in-workspace` (classes that map to local project files).              |
| Org-only tests          | `@org-only` (deployed to org, not present locally).                     |
| Suites only             | `@test-suite`                                                           |
| Exclude matches         | Prefix with `!` (e.g. `!@org-only` or `!Heavy` to hide matching items). |

Combine as needed for your VS Code version’s filter rules.

**Run In-Workspace Tests** is also a separate run profile (chevron next to Run)—it only executes tests tagged as in-workspace.

## See results in the Test Results tab

After a run:

- Pass/fail icons update on the tree; expand failed items for messages/stack traces.
- Open the **Test Results** panel (from the run notification or Testing UI) for the full run output, failures, and timing.
- With **concise** results enabled (`salesforcedx-vscode-apex-testing.test-run-concise`), the UI emphasizes failures.

Re-running clears prior result decorations until the new run completes; use **Refresh** on the controller if the tree looks out of sync with the org.

## Related commands

From the Command Palette: **Run Apex Tests**, **Run Apex Test Class**, **Run Apex Test Method**, **Run Apex Test Suite**, plus suite create/add. The explorer is the main place to browse, filter, and pick what to run.
