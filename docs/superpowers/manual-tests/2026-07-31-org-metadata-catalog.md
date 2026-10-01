# OrgMetadataCatalog Manual Validation

**Work item:** W-23613533

**Primary workspace:** `/Users/peter.hale/git/dreamhouse-lwc-clean`
**Purpose:** Validate the catalog through its consumer workflows in an Extension Development Host built from the current branch.

## Test record

Record the extension commit, org ID, org username/alias, org tracking mode, and test time before starting. Keep the Salesforce CLI, Salesforce Metadata, Apex Tests, and Extension Host output channels available so a failure can be paired with its surrounding output.

| Field | Value |
| --- | --- |
| Extension commit | |
| Workspace commit | |
| Org ID | |
| Org alias or username | |
| Source-tracking org? | Yes / No |
| Tester and date | |

Use a scratch org or another disposable org for tests that deploy or delete metadata. Back up `FooTest.cls` and `FooTest.cls-meta.xml` outside the workspace before the Apex test scenarios.

## How to drive the catalog

Most catalog behavior is not exposed as a command of its own. Use the consumer or mutation action in this table to make the catalog do the work under test.

| Behavior under test | Action that drives it | Observable evidence |
| --- | --- | --- |
| SObject list and descriptions | Run **SFDX: Refresh SObject Definitions** | Files beneath `.sfdx/tools/sobjects`, `.sfdx/tools/soqlMetadata`, and `.sfdx/typings/lwc/sobjects` are regenerated |
| SOQL discovery | Run **SFDX: Create Query in SOQL Builder**, select an object, then open its field selector | Object and field choices match the default org |
| Operation-stream invalidation | Deploy, retrieve, or delete a component from the primary VS Code window | The affected consumer updates once without manually reloading the window |
| External-change invalidation | Edit Apex in Developer Console, edit schema in Setup, or deploy from a second workspace pointed at the same org | Source tracking reports the change and the next consumer read returns the new revision |
| Remote source materialization | Open an org-only Apex test or run **SFDX: Diff Source Against Org** | An `sf-org-metadata:` document is backed by a snapshot below `.sf/orgs/<orgId>/metadata-shadow` |
| Remote revision reuse | Repeat the same open or diff without changing the org | No additional revision directory is created |
| Remote revision replacement | Save a new org version externally, wait for source tracking, then open or diff again | A new revision directory is created while an already-open old document stays stable |
| Conflict status | Make different local and external edits to the same component, then deploy or retrieve | The Org Differences view identifies the conflict and opens the catalog-backed remote side |
| Org partitioning | Click the default-org name in the status bar and choose another org | Views and `sf-org-metadata:` documents change to the selected org; shadow paths remain separated by org ID |
| Durable catalog state | Run **SFDX: Show Org Metadata Catalog State** after a consumer action | The active org's schema-versioned `.sf/orgs/<orgId>/metadata-catalog/catalog.json` opens with inventory, SObject, tracking, generation, and observation data |

Manual UI checks prove consumer behavior, but they cannot by themselves prove an exact provider-call count or operation-envelope count. For request coalescing and deduplication, use the absence of repeated UI updates plus shadow-directory changes as manual evidence; use exported Effect spans or the automated contract tests when exact counts are required.

The persisted JSON is the latest durable checkpoint, not a dump of semaphores, subscriptions, open editors, workspace-presence projections, or in-flight requests. Leave it open through two unchanged source-tracking polls: the file must not be replaced and its generation must remain unchanged. After restarting the Extension Development Host, open a catalog consumer and then run **SFDX: Show Org Metadata Catalog State** to verify that the generation and original observation timestamps were restored. Verify fresh workspace presence separately through Org Browser decorations or Apex Test navigation.

Use the primary Extension Development Host for all observations. For an external mutation, use one of these drivers:

- **Apex:** Run **SFDX: Open Default Org**, open Developer Console in the browser, edit a disposable class, and save it.
- **Schema:** Run **SFDX: Open Default Org**, then use **Setup -> Object Manager -> Property -> Fields & Relationships**.
- **Any metadata type:** Open a second VS Code window or terminal in another Salesforce project authorized to the same org, make the change there, and deploy it. Do not use the primary window for this step; that would test the local operation stream rather than external source tracking.

## Pass criteria

The suite passes when each applicable test below passes and none of these known regressions occurs:

- Org Browser remains indefinitely busy or refreshes repeatedly.
- `Missing metadata type definition in registry for id 'TagSet'` prevents the tree from loading.
- `Cannot read properties of null (reading 'startsWith')` appears during deployment.
- Downloading an org-only Apex test creates duplicate Test Explorer entries.
- Downloading an org-only Apex test collapses and rebuilds the Test Explorer tree.
- Navigation opens a deleted workspace URI instead of an `sf-org-metadata:` document.
- A later remote materialization changes or breaks an already-open diff document.
- Metadata from one org is displayed after switching to another org.

## Core workflow

Run OM-01 through OM-08 in order. Later tests build on the same workspace and org state.

### OM-01 — Fresh deployment and initial Org Browser discovery

**Setup:** Use a new scratch org in which the Dreamhouse metadata is absent.

1. Set the scratch org as the project default org.
2. Run **SFDX: Deploy This Source to Org** for the workspace source.
3. Confirm the deployment succeeds.
4. Open Org Browser and wait for its initial discovery to finish.
5. Collapse and reopen two metadata type nodes.

**Expected:**

- The deployment completes without a `startsWith` error or error notification.
- Org Browser stops showing its busy indicator and displays the deployed metadata.
- A type unknown to the local SDR registry, such as `TagSet`, does not prevent the rest of the tree from loading; an unknown type remains navigable through the generic `.xml` fallback.
- Expanding a previously visited node does not start repeated whole-tree refreshes.
- One normal server discovery cycle after deployment is acceptable; the test does not require zero discovery calls.

### OM-02 — Hierarchy and workspace presence

1. In Org Browser, expand **Custom Objects**.
2. Expand a Dreamhouse custom object such as `Property__c`.
3. Expand its fields and choose a field that exists both in the org and workspace.
4. Open the object and field entries where the view permits it.

**Expected:**

- The tree presents `Custom Object -> Custom Field` hierarchy rather than flattening fields into an unrelated type branch.
- Object and field names match the deployed workspace.
- The workspace-presence decoration is shown for components present locally.
- Opening a local component resolves to its workspace file.

### OM-03 — Apex test local-to-org-only transition

**Setup:** Ensure `FooTest` exists in the workspace and org and appears once in Apex Tests.

1. Expand several neighboring Apex Test nodes and leave them expanded.
2. Move both `FooTest.cls` and `FooTest.cls-meta.xml` completely outside the workspace. Do not delete the backup.
3. Wait for Org Browser and Apex Tests to process the workspace change.
4. Confirm the Org Browser workspace-presence decoration is removed for `FooTest`.
5. Select `FooTest.testNothing` in Apex Tests.

**Expected:**

- `FooTest` remains present as org-only metadata.
- Apex Tests retains exactly one `FooTest` entry.
- Method navigation opens an `sf-org-metadata:` document containing the org source, not the deleted workspace URI.
- The remote document offers the Download CodeLens.
- Unrelated expanded Test Explorer nodes remain expanded.

### OM-04 — Download an org-only Apex test

Continue from OM-03.

1. Click the Download CodeLens in the remote `FooTest` document.
2. Wait for retrieval and test discovery to finish.
3. Select `FooTest.testNothing` again.
4. Inspect the Org Browser entry and the Apex Tests hierarchy.

**Expected:**

- Source and companion metadata are restored to the workspace.
- Org Browser changes `FooTest` back to local-and-org presence.
- Apex Tests contains one `FooTest`, under its correct package/namespace grouping.
- Navigation now resolves to the restored workspace URI.
- The obsolete ephemeral editor is closed or replaced; it is not left as a stale duplicate.
- The whole Test Explorer tree does not collapse and rebuild. Previously expanded unrelated nodes stay expanded.

### OM-05 — Refresh SObject Definitions

1. Run **SFDX: Refresh SObject Definitions**, choose **Custom SObjects**, and wait for completion.
2. Confirm `.sfdx/tools/soqlMetadata/customObjects/Property__c.json`, `.sfdx/tools/sobjects/customObjects/Property__c.cls`, and `.sfdx/typings/lwc/sobjects/Property__c.d.ts` exist.
3. Run the command again and choose **Standard SObjects**.
4. Confirm `.sfdx/tools/soqlMetadata/standardObjects/Account.json` and `.sfdx/tools/sobjects/standardObjects/Account.cls` exist.
5. Confirm the three Custom artifacts from step 2 still exist after the Standard refresh.
6. Inspect `.sfdx/tools/soqlMetadata/typeNames.json` and confirm it contains both `Account` and `Property__c`.
7. Run the command once more and choose **All SObjects**.

**Expected:**

- The command completes and reports processed standard and custom SObjects.
- `typeNames.json` includes queryable Dreamhouse objects such as `Property__c`.
- Generated descriptions and faux definitions contain fields from the selected org.
- A scoped refresh replaces only its selected category; it does not remove artifacts or type-index entries belonging to the other category.
- The final All refresh completes normally and replaces both categories.
- Org Browser does not enter a refresh loop while generated files are written.

### OM-06 — SOQL object and field discovery

1. Run **SFDX: Create Query in SOQL Builder**, supply a file name, and accept the default `scripts/soql` location.
2. Open the object selector and select `Property__c`.
3. Open the field selector and choose `Id`, `Name`, and one Dreamhouse custom field.
4. Use **Switch Between SOQL Builder and Text Editor**.
5. In text mode, remove one selected field, place the cursor after `SELECT`, and invoke completion with **Ctrl+Space** (or **Control+Space** on macOS).

**Expected:**

- Queryable objects are offered; non-queryable objects are not introduced by catalog migration.
- Fields for `Property__c` are populated from the selected org's schema.
- SOQL Builder and text completion agree on object and field identity.
- Repeated completion requests do not make Org Browser refresh or produce duplicate notifications.

### OM-07 — Custom Field invalidates parent schema

**Setup:** First complete OM-06 so the catalog has observed the `Property__c` schema.

1. In the primary workspace, create `force-app/main/default/objects/Property__c/fields/CatalogManual__c.field-meta.xml` with this disposable field definition:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
       <fullName>CatalogManual__c</fullName>
       <label>Catalog Manual</label>
       <length>40</length>
       <type>Text</type>
   </CustomField>
   ```

2. In Explorer, right-click that file and run **SFDX: Deploy This Source to Org**.
3. After the success notification, return to SOQL Builder, switch to another object, then select `Property__c` again.
4. Open the field selector and find `CatalogManual__c`. Do this before running Refresh SObject Definitions; the point is to prove the deploy invalidated the cached parent description.
5. Run **SFDX: Refresh SObject Definitions** and inspect `.sfdx/tools/soqlMetadata/customObjects/Property__c.json` for `CatalogManual__c`.
6. In Explorer, right-click the disposable field and run **SFDX: Delete from Project and Org**. Confirm the deletion, then select `Property__c` again in SOQL Builder and verify the field is gone.

**Expected:**

- The successful `CustomField` operation invalidates the parent `Property__c` SObject observation.
- The first post-deploy SOQL request reacquires the object description and offers `CatalogManual__c` without a manual catalog refresh.
- Refresh writes `CatalogManual__c` into the generated object description.
- The successful delete invalidates the parent again and removes the field from a later consumer read.
- Field completion remains complete and contains no duplicates.
- The operation results in one coherent consumer update rather than a series of whole-tree refreshes.

### OM-08 — Targeted notification and refresh-storm regression

1. In Org Browser, expand several type and component nodes.
2. Deploy a multi-file component such as an LWC bundle, or deploy a folder containing source and companion metadata files.
3. While deployment completes, watch Org Browser, Apex Tests, notifications, and output.
4. After completion, edit and save an unrelated local metadata file without deploying it.

**Expected:**

- The mutation publishes one logical completion/update even when the CLI result contains source, sidecar, and bundle files.
- Org Browser does not repeatedly clear, repopulate, or remain busy.
- Matching filesystem events from the completed operation are suppressed as duplicates.
- The later unrelated manual edit is still observed; suppression does not hide future workspace changes.

## Remote document and diff workflow

### OM-09 — Reuse the same remote revision

1. Make `FooTest` org-only again using the OM-03 backup procedure.
2. Open `FooTest.testNothing` from Apex Tests and wait for the remote document to load.
3. Locate `.sf/orgs/<orgId>/metadata-shadow/ApexClass/FooTest/revisions` in the workspace.
4. Record the revision directory and its `.catalog.json` manifest.
5. Close and reopen the same method without changing the org source.
6. Inspect the revisions directory again.

**Expected:**

- Both opens use the same `sf-org-metadata:` identity and content.
- The second open reuses the existing revision; it does not create another snapshot for unchanged remote source.
- The manifest identifies `ApexClass/FooTest`, the primary document, component files, materialization time, and remote revision when the provider supplies one.
- Shadow-store writes do not create workspace-presence or Org Browser changes.

### OM-10 — Diff uses a stable remote revision

1. Restore `FooTest` locally if necessary, then make a local edit without deploying it.
2. Run **SFDX: Diff Source Against Org** for `FooTest`.
3. Verify the diff compares the local edit with the current org source.
4. Leave the diff and its remote document open.
5. Run **SFDX: Open Default Org**, open Developer Console, add a harmless comment to `FooTest`, and save it.
6. Back in the Extension Development Host, run **SFDX: View Changes in Default Org** until `FooTest` is reported, or wait for the configured source-tracking poll.
7. Run the diff command again.

**Expected:**

- The first diff displays the correct local and remote content.
- The later diff uses a new remote revision when the org content changed.
- The first, already-open remote document remains readable and unchanged.
- Repeating a diff with no remote change reuses its snapshot.

### OM-11 — Shadow retention

1. Use `FooTest` or another disposable Apex class and open the first **SFDX: Diff Source Against Org** result. Record the current directory beneath `.sf/orgs/<orgId>/metadata-shadow/ApexClass/<class>/revisions`.
2. Close that first diff. In Developer Console, add a unique comment such as `// catalog revision 2` and save.
3. In VS Code, run **SFDX: View Changes in Default Org**, then run **SFDX: Diff Source Against Org** to materialize revision 2.
4. Repeat the Developer Console save, source-tracking view, and diff for revisions 3 and 4, changing the comment number each time.
5. Inspect the component's revisions directory after revision 4.
6. For the protection case, repeat from a new starting revision but leave that starting diff document open while producing and materializing three later revisions.

**Expected:**

- Normally only the current and two newest prior valid snapshots remain: three total.
- An older snapshot backing an open editor document is retained in addition to the normal three.
- Closing that document allows the protected snapshot to be pruned by a later successful publication.
- Cleanup is per org and component; revisions for unrelated components are untouched.

## Change tracking and org isolation

### OM-12 — External source-tracking change

**Applies to:** Scratch orgs and other source-tracking orgs.

1. With Org Browser open, run **SFDX: Open Default Org**, open Developer Console, add a unique comment to a disposable Apex class, and save it.
2. Return to VS Code without deploying or retrieving from the primary window.
3. Wait for the extension's normal source-tracking poll, or run **SFDX: View Changes in Default Org** to force a visible status read.
4. Inspect the affected Org Browser branch and, for an Apex test class, Apex Tests. Open or diff the class to verify the new remote content.
5. Wait through another unchanged polling interval and confirm no second visible update occurs.

**Expected:**

- The changed component is updated without a full inventory rebuild.
- A `CustomField` change also invalidates its parent SObject schema.
- An unchanged later poll publishes no second visible update.
- An external removal already covered by a completed local operation does not produce a duplicate removal notification.

### OM-13 — Tracking conflict

**Applies to:** Source-tracking orgs.

1. Add `// local conflict` to a disposable Apex class in VS Code but do not deploy it.
2. In Developer Console, add `// remote conflict` at a different location in the same class and save.
3. Back in VS Code, run **SFDX: View Changes in Default Org** so the remote change is visible.
4. Right-click the local class and run **SFDX: Deploy This Source to Org**.
5. Open **Org Differences** and choose **Compare Files** for the conflict.

**Expected:**

- The conflict is detected from catalog change status.
- The remote side is materialized through the catalog and displays the actual org revision.
- Resolving or completing the operation produces one targeted catalog update.

### OM-14 — Non-tracking timestamp screening

**Applies to:** A disposable non-source-tracking org.

1. Select two disposable Apex classes, A and B, whose local and remote versions are initially synchronized. Ensure conflict detection is enabled.
2. Record the revision directories, if any, below `.sf/orgs/<orgId>/metadata-shadow/ApexClass/A/revisions` and the corresponding path for B.
3. In Developer Console, change class A and save it. Do not change B in the org.
4. In the primary workspace, make different local edits to both A and B without deploying either edit.
5. Select both files in Explorer, right-click, and run **SFDX: Deploy This Source to Org**.
6. When conflict detection stops the deployment, open **Org Differences** and compare A.
7. Inspect both shadow revision directories again, then restore both classes from a known-good version.

**Expected:**

- Unchanged components are screened by catalog timestamps and are not remotely materialized merely to check conflict status.
- A receives a new remote snapshot and is reported as a conflict with the correct remote source.
- B receives no new remote snapshot merely for conflict screening, because its server timestamp did not change.

### OM-15 — Active org switch

**Setup:** Use two disposable orgs with different `FooTest` contents. Record both org IDs.

1. Click the default-org name in the VS Code status bar, select org A, make `FooTest` org-only, and open its method from Apex Tests.
2. Confirm the remote content is org A's version and note its shadow path.
3. Click the default-org name in the status bar and select org B.
4. Reopen Org Browser and Apex Tests, then open `FooTest`.
5. Switch back to org A.

**Expected:**

- A logical document belonging to the previously active org is closed or immediately rejected after the switch.
- Org Browser and Apex Tests display org B data after the switch, never a mixture of A and B.
- Org B's remote document contains B's source.
- Shadow snapshots are isolated beneath their respective org-ID directories.
- Switching back reacquires or reuses only org A observations and artifacts.

## Failure capture

For each failure, save:

1. The test ID and exact step.
2. Extension and workspace commits plus org ID.
3. The full notification text and relevant Output channel segment.
4. Whether reloading the Extension Development Host changes the behavior.
5. The affected `sf-org-metadata:` URI and the corresponding shadow `.catalog.json`, if present.
6. A screenshot for tree state, duplicates, stale navigation, or refresh loops.

When span export is enabled, include the catalog/provider span containing the error. Shadow retention is specifically observable through `OrgMetadataShadowStore.pruneRevisions`, including scanned, protected, deleted, and failed-delete counts.

## Results

| Test | Result | Notes / evidence |
| --- | --- | --- |
| OM-01 | Pass / Fail / N/A | |
| OM-02 | Pass / Fail / N/A | |
| OM-03 | Pass / Fail / N/A | |
| OM-04 | Pass / Fail / N/A | |
| OM-05 | Pass / Fail / N/A | |
| OM-06 | Pass / Fail / N/A | |
| OM-07 | Pass / Fail / N/A | |
| OM-08 | Pass / Fail / N/A | |
| OM-09 | Pass / Fail / N/A | |
| OM-10 | Pass / Fail / N/A | |
| OM-11 | Pass / Fail / N/A | |
| OM-12 | Pass / Fail / N/A | |
| OM-13 | Pass / Fail / N/A | |
| OM-14 | Pass / Fail / N/A | |
| OM-15 | Pass / Fail / N/A | |
