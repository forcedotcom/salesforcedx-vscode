# OrgMetadataCatalog Manual Verification

## Purpose

Verify that metadata-owning provider services record successful observations and mutations in `OrgMetadataCatalog` (OMC), while retaining ownership of their acquisition APIs.

This checklist covers:

- Metadata type and component discovery
- SObject discovery and descriptions
- Source tracking
- Retrieve, deploy, delete, and diff operations
- Persistence deduplication
- Failed operations
- Org isolation

## Test Record

- Tester:
- Date:
- Branch/commit:
- VS Code version:
- Extension Development Host version:
- Workspace:
- Default org alias:
- Default org ID:
- Scratch org expiration:
- Catalog path: `.sf/orgs/<ORG_ID>/metadata-catalog/catalog.json`

## Result Legend

- [ ] Not run
- [x] Passed
- Record failures as `FAIL` beside the checkbox and add a defect entry at the end of the document.

Catalog persistence is asynchronous and coalesced. Allow approximately one second after an operation before inspecting `catalog.json`.

Do not delete `catalog.json` while the Extension Development Host is running. OMC retains in-memory state. If a clean baseline is required, close the host before moving the existing catalog aside, or use a fresh scratch org.

## Inspection Commands

Replace `<ORG_ID>` in these commands with the authoritative org ID.

### Catalog summary

```bash
jq '{
  version,
  generation,
  metadataTypes: (.metadataTypes | length),
  metadataListings: (.metadataListings | length),
  inventoryTypes: (.inventory | length),
  sobjects: {
    list: (.sobjects.list | length),
    descriptions: (.sobjects.descriptions | length)
  },
  tracking: (.tracking | length)
}' .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

### Catalog generation and modification time

```bash
jq '.generation' .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
stat -f '%m' .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

## 1. Metadata Type Discovery

Validates `MetadataDescribeService.describe()` capture.

### Actions

- [x] Start with Org Browser closed.
- [x] Turn Local off and leave Org on.
- [x] Open Org Browser and press Refresh.
- [x] Wait for the metadata-type tree to populate without expanding any type.
- [x] Allow approximately one second for the catalog checkpoint.
- [x] Inspect the catalog summary.
- [x] Inspect the `ApexClass` type observation:

```bash
jq '.metadataTypes[] | select(.xmlName == "ApexClass")' \
  .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

### Expected results

- [x] Org Browser populates normally.
- [x] The org-only tree contains metadata types.
- [x] The snapshot version is `2`.
- [x] `metadataTypes` is populated.
- [x] `ApexClass` includes its directory, suffix, folder behavior, and child-type information.
- [x] `metadataListings` remains empty because no type was expanded.
- [x] `inventory` remains empty because no type was expanded.
- [x] The catalog is stored beneath the authoritative org ID.

### Evidence/notes

Initial warm-cache result: **PASS**

- Workspace: `/Users/peter.hale/git/dreamhouse-lwc-clean`
- Catalog: `.sf/orgs/00Ddq00000EYZGDEA5/metadata-catalog/catalog.json`
- Snapshot org ID: `00Ddq00000EYZGDEA5`
- Snapshot version: `2`
- Written at: `2026-08-06T15:37:22.680Z`
- Generation: `25`
- `metadataTypes`: `192`
- `metadataListings`: `0`
- `inventory`: `0`
- `ApexClass` was observed at `2026-08-06T15:36:56.962Z` with directory `classes`, suffix `cls`, `inFolder: false`, and `metaFile: true`.
- No malformed metadata-type observations were detected.
- Snapshot size: 68,127 bytes.

## 2. Metadata Listing Discovery

Validates `MetadataDescribeService.listMetadata()` capture.

### Actions

- [x] Expand `ApexClass` in Org Browser.
- [x] Expand `CustomObject` in Org Browser.
- [x] Inspect their metadata listings:

```bash
jq '.metadataListings[]
  | select(.xmlName == "ApexClass" or .xmlName == "CustomObject")' \
  .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

### Expected results

- [x] Both types have recorded component listings.
- [x] Each listing has an `observedAt` value.
- [x] Org Browser correctly represents local and org presence.
- [x] Expanding an individual Custom Object shows its nested Custom Fields.

### Evidence/notes

Catalog result: **PASS**

- Snapshot written at: `2026-08-06T15:39:14.604Z`
- Generation: `31`
- `ApexClass` listing: 10 components, observed at `2026-08-06T15:38:58.609Z`.
- `ApexClass` inventory: 10 components and no duplicate names.
- `CustomObject` listing: 278 components, observed at `2026-08-06T15:39:08.156Z`.
- `CustomObject` inventory: 278 components and no duplicate names.
- Listing and inventory membership matched exactly for both types: zero listing-only and zero inventory-only components.
- Presence decoration was visually confirmed as correct.
- OMC contained seven `Broker__c` CustomField inventory members and 25 `Property__c` members.
- Before the workspace's `dreamhouse` permission set was assigned, both OMC and direct `sf sobject describe` returned 11 system fields and zero custom fields. This was expected field-level visibility behavior, not lost OMC state.
- After running `sf org assign permset -n dreamhouse`, expanding `Broker__c` displayed its fields correctly.
- In fresh scratch org `00DWL00000DER2V2AX`, the refreshed OMC description contained 18 fields: 11 system fields and all seven custom fields.
- The refreshed custom fields included their REST enrichment such as type, length, scale, and precision.
- Snapshot written at: `2026-08-06T16:51:26.474Z`; generation: `53`.

## 3. Foldered Metadata

Validates folder-specific metadata listing observations.

### Actions

- [x] Expand `Report` in Org Browser.
- [x] Expand the available report folders.
- [x] Inspect Report listings:

```bash
jq '.metadataListings[] | select(.xmlName == "Report")' \
  .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

### Expected results

- [x] Folder navigation works in Org Browser, including valid empty folders.
- [x] A folder-level observation is present.
- [x] Components appear under the correct folder.
- [x] Separate folders do not overwrite each other's observations.

### Evidence/notes

Catalog acquisition result: **PASS**

Final tree projection result: **PASS**

- Org: `00DWL00000DER2V2AX`
- OMC recorded five Report folders: `EBotR_v3`, `EBotR_v5`, `EinsteinBotReports`, `EinsteinBotReports_v2`, and `unfiled$public`.
- The first four folders each had a valid folder-specific Report listing with zero components.
- `unfiled$public` had a valid folder-specific listing containing six reports and expanded successfully.
- Opening each empty folder raised an error notification containing only its folder name.
- `OrgCatalogTreeProjection.getChildren()` treats every referenced node with zero projected children as `FileNotADirectory`. That is invalid for known folder entries, where an empty child collection is a successful result.
- The error notification lacks useful context because `FileSystemError.FileNotADirectory(reference.fullName)` is constructed with only the content name.
- Fix implemented: known folders with zero projected children now return an empty child collection; true non-directory errors include both metadata type and full name.
- Regression coverage added for a known empty Report folder. The focused catalog suite passes 23 tests.
- Manual retest passed: all five folders opened without errors; the four empty folders returned no children and `unfiled$public` exposed its six reports.
- Final result: **PASS**


## 4. Refresh SObjects

Validates `MetadataDescribeService.listSObjects()` and SObject-description capture.

### Actions

- [x] Run `SFDX: Refresh SObject Definitions` and select custom objects.
- [x] Verify `.sfdx/tools/sobjects/customObjects` is populated.
- [x] Run the refresh again and select standard objects.
- [x] Verify `.sfdx/tools/sobjects/standardObjects` is populated.
- [x] Run the refresh once more and select custom objects.
- [x] Verify `.sfdx/tools/sobjects/standardObjects` remains populated.
- [x] Inspect selected SObject observations:

```bash
jq '.sobjects.list[0:5],
    [.sobjects.descriptions[]
      | select(.name == "Property__c" or .name == "Account")]' \
  .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

### Expected results

- [x] `sobjects.list` is populated.
- [x] Descriptions contain reduced field and object information.
- [x] Refreshing standard objects preserves custom artifacts.
- [x] Refreshing custom objects preserves standard artifacts.

### Evidence/notes

Result: **PASS**

- Org: `00DWL00000DER2V2AX`
- Snapshot written at: `2026-08-06T17:09:00.031Z`; generation: `188`.
- Global SObject list: 1,397 summaries, including two custom and 1,395 standard objects; no duplicate names.
- Recorded descriptions: 732 total, including two custom and 730 standard objects; no duplicate names.
- Every recorded description had `rest-api` provenance.
- Generated artifacts matched the descriptions exactly: two files in `customObjects` and 730 files in `standardObjects`.
- `Broker__c` retained its 18-field description after standard refresh; `Property__c` contained 39 fields and `Account` contained 59 fields.
- Running standard refresh preserved `Broker__c.cls` and `Property__c.cls`; both standard and custom artifact folders remained populated.
- Running custom refresh again regenerated the two custom artifacts at approximately `2026-08-06 11:11 MDT` while preserving all 730 standard artifacts from approximately `11:08 MDT`.
- OMC retained 732 unique descriptions after the reciprocal refresh: two custom and 730 standard. Unchanged normalized descriptions kept their original observation timestamps.
- The formatted snapshot was 31,409,025 bytes after recording 732 descriptions. It settled after the refresh and did not continue rewriting without activity.


## 5. SOQL Discovery

Validates SOQL consumers use `MetadataDescribeService` and recorded descriptions.

Use an object not already described when practical.

### Actions

- [x] Open SOQL Builder or a SOQL file.
- [x] Request object completion.
- [x] Select an object.
- [x] Request field completion for that object.
- [x] Inspect `sobjects.list` and `sobjects.descriptions` after completion.

### Expected results

- [x] Object completion works normally.
- [x] Field completion works normally.
- [x] The selected object's description is recorded or reused from OMC.
- [x] The SOQL consumer does not require an OMC acquisition cover method.

### Object tested

Not recorded by tester.

### Evidence/notes

Result: **PASS**

- Object completions appeared after `FROM`.
- Field completions appeared for the selected SObject.
- OMC retained 1,397 SObject summaries, including 1,166 queryable objects.
- OMC retained 732 unique descriptions with no duplicates.
- Description count and observation timestamps remained unchanged, showing that the selected object used an already-recorded provider result rather than creating redundant normalized state.
- Snapshot generation was `207` at `2026-08-06T17:14:33.082Z`; the formatted snapshot remained 31,409,025 bytes.

### Cache-miss follow-up

`AccountFeed` is queryable and present in `sobjects.list`, but was absent from `sobjects.descriptions` before this follow-up.

- [x] Reload the Extension Development Host to clear the in-memory provider cache while retaining the persisted OMC snapshot.
- [x] Confirm `AccountFeed` is initially absent:

```bash
jq 'any(.sobjects.descriptions[]; .name == "AccountFeed")' \
  .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

- [x] In SOQL Builder or a SOQL file, select `AccountFeed` from object completion.
- [x] Request field completion for `AccountFeed`.
- [x] Allow approximately one second for the OMC checkpoint.
- [x] Confirm its description is now recorded:

```bash
jq '.sobjects.descriptions[]
  | select(.name == "AccountFeed")
  | {name, observedAt, provenance, fieldCount: (.fields | length)}' \
  .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

Expected:

- [x] `AccountFeed` appears in object completion after `FROM`.
- [x] Field completion succeeds for `AccountFeed`.
- [x] `AccountFeed` appears once in `sobjects.descriptions`.
- [x] Its provenance is `rest-api` and it has a current `observedAt` value.
- [x] Description count increases from 732 to 733.
- [x] Repeating completion does not add a duplicate or rewrite the unchanged observation.

Cache-miss evidence:

- `AccountFeed` was recorded at `2026-08-06T17:18:21.213Z` with `rest-api` provenance and 17 fields.
- Total description count increased to 733 with no duplicate `AccountFeed` entry.
- Snapshot generation was `223` and written at `2026-08-06T17:18:50.846Z`.
- Explicit field completion returned AccountFeed-specific fields including `CommentCount`, `BestCommentId`, and `LikeCount`.
- After repeated completion, description count remained 733, exactly one `AccountFeed` observation existed, and its `observedAt` value remained `2026-08-06T17:18:21.213Z`.

## 6. Remote Source-Tracking Capture

Validates `SourceTrackingService.getStatus()` remote-observation capture and deduplication.

### Actions

- [x] Change an Apex class or Custom Object directly in the org.
- [x] Run `SFDX: View All Changes (Local and in Default Org)` or trigger source-tracking status refresh.
- [x] Inspect relevant tracking observations:

```bash
jq '.tracking[] | select(
  .xmlName == "ApexClass" or
  .xmlName == "CustomObject" or
  .xmlName == "CustomField"
)' .sf/orgs/<ORG_ID>/metadata-catalog/catalog.json
```

- [x] Record catalog generation and modification time.
- [x] Run the same source-status request without making another change.
- [x] Record catalog generation and modification time again.

### Expected results

- [x] The remote change appears with a nonempty signature.
- [x] The affected catalog projection is invalidated and reacquired when requested by an expanded consumer node.
- [x] Unrelated metadata types remain stable.
- [x] Repeating identical status does not increment `generation`.
- [x] Repeating identical status does not rewrite `catalog.json`.
- [x] The UI does not receive a redundant catalog refresh.

### Component changed

- Initial change: `ApexClass/FileUtilitiesTest`
- Targeted-invalidation change: `CustomField/Broker__c.FooField__c`

### Before/after generation and modification time

Before repeat-status check:

- Generation: `237`
- Written at: `2026-08-06T17:25:39.375Z`
- File modification time: `2026-08-06 11:25:39 MDT`

After manually running `SFDX: View All Changes (Local and in Default Org)` with no additional org change:

- Generation: `237` (unchanged)
- Written at: `2026-08-06T17:25:39.375Z` (unchanged)
- File modification time: `2026-08-06 11:25:39 MDT` (unchanged)
- Tracking observations: two total, with no duplicate identities
- `FileUtilitiesTest` signature: unchanged

### Evidence/notes

- The status bar displayed one remote source change after the scheduled check.
- OMC recorded `ApexClass/FileUtilitiesTest` with signature `modify`, revision 164, remote timestamp `2026-08-06T17:25:34.000+0000`, member ID `01pWL00000L9U2oYAF`, and modified state.
- OMC also retained the pre-existing `Profile/Admin` observation, so total tracking observations were two while the newly relevant Apex change count was one.
- No projected inventories were present at inspection time, so targeted Apex invalidation versus unrelated-inventory preservation cannot be proven from this run. The normalized `ApexClass` listing remained retained.
- Repeating the identical status request produced no checkpoint and no normalized-state change.
- With Org Browser open during the repeated command, no tree shape change was observed. This confirms identical tracking status did not publish a redundant catalog refresh to the consumer.
- For targeted invalidation, `ApexClass` and `Broker__c` fields were expanded before adding `Broker__c.FooField__c` directly in the org.
- The command reported six source rows that normalized to five OMC component identities: the Apex source and sidecar rows correctly remained one `ApexClass/FileUtilitiesTest` observation.
- OMC recorded `CustomField/Broker__c.FooField__c` as an add at revision 165 with remote timestamp `2026-08-06T17:33:48.000+0000`.
- Expanded Broker fields refreshed automatically. The CustomField listing and inventory both contained 33 fields, including `FooField__c`; Broker increased to eight inventoried custom fields.
- The refreshed `Broker__c` REST description contained 19 total fields, including eight custom fields. `FooField__c` was captured as a string with length 10.
- No local `FooField__c.field-meta.xml` existed, matching the org-only presence shown by Org Browser.
- `ApexClass` remained visually unchanged with ten components, and its normalized listing retained its earlier `2026-08-06T17:29:21.487Z` observation.
- Final item 6 result: **PASS**

## 7. Local-Only Source Change

Validates local-only status does not replace remote observations.

### Actions

- [x] Record the current `.tracking` array.
- [x] Modify a local source file without changing the org.
- [x] Trigger source-status discovery.
- [x] Compare `.tracking` before and after.
- [x] Record a settled post-edit baseline after workspace projection updates complete.
- [x] Repeat source-status discovery without another local or remote change.

### Expected results

- [x] Existing remote observations remain intact.
- [x] The local-only change does not replace the remote tracking snapshot.
- [x] No unnecessary checkpoint occurs solely because local status was rediscovered.

### Evidence/notes

Baseline before local-only edit:

- Org: `00DWL00000DER2V2AX`
- Generation: `263`
- Written at: `2026-08-06T17:34:27.363Z`
- File modification time: `2026-08-06 11:34:27 MDT`
- Snapshot size: 31,308,028 bytes
- Tracking observations: five
  - `ApexClass/FileUtilitiesTest`: modify, revision 164
  - `CustomField/Broker__c.FooField__c`: add, revision 165
  - `FlexiPage/Broker_Record_Page`: modify, revision 264
  - `Layout/Broker__c-Broker Layout`: modify, revision 166
  - `Profile/Admin`: modify, revision 167

After editing local `ApexClass/FooTest` and running source-status discovery:

- The command reported one local change and the same existing remote changes.
- OMC retained exactly the same five remote identities and signatures.
- OMC did not add `ApexClass/FooTest` to remote tracking observations.
- No duplicate tracking identities were introduced.
- Org Browser did not visibly refresh or thrash.
- Generation advanced from 263 to 273 while workspace events invalidated and rebuilt expanded projections. Because the original baseline preceded the local file edit, this change cannot be attributed to source-status discovery alone.

Settled post-edit baseline for the final status-only comparison:

- Generation: `273`
- Written at: `2026-08-06T17:40:03.715Z`
- File modification time: `2026-08-06 11:40:04 MDT`
- Snapshot size: 31,308,028 bytes
- Tracking observations: five, unchanged

After repeating the identical source-status discovery:

- The command again reported the same six remote source rows, one local `ApexClass/FooTest` change, and no conflicts.
- OMC retained exactly the same five remote identities and signatures; `FooTest` remained absent from remote tracking observations.
- The recorder Effect span reported `observationCount: 5`, `changedCount: 0`, and `affectedTypeCount: 0`.
- The source-status command began at approximately `2026-08-06T17:42:58.817Z`.
- The apparent catalog generation change from 273 to 278 was not caused by source-status capture. Org Browser projection work had already rebuilt the four expanded inventories between approximately `17:42:58.15Z` and `17:42:58.52Z`, and the catalog checkpoint completed at `17:42:58.577Z`, before the command began.
- No recorder persistence was queued and no tracking catalog-change event was emitted by the repeated status request.
- Org Browser showed no visible refresh or tree thrashing.
- Final item 7 result: **PASS**


## 8. Apex Test Download

Validates retrieve capture occurs before Apex Testing asks OMC for the resulting document URI.

### Actions

- [x] Choose an Apex test class that exists locally and in the org.
- [x] Move the test class and its metadata XML out of the workspace while leaving it in the org.
- [x] Confirm Org Browser changes the class to org-only.
- [x] Find the class in Apex Test Explorer.
- [x] Open a test method and confirm the ephemeral document opens.
- [x] Use the download CodeLens.

### Expected results

- [x] Retrieve succeeds.
- [x] The local document resolves immediately when retrieve completes.
- [x] Apex Test Explorer contains only one entry for the class.
- [x] Navigation resolves to the downloaded local URI.
- [x] The Test Explorer tree does not collapse and reopen.
- [x] No source-status interval is required before the document resolves.

### Test class

- `ApexClass/FooTest`, containing two test methods

### Evidence/notes

- With `ApexClass` expanded, deleting `FooTest.cls` and `FooTest.cls-meta.xml` changed Org Browser presence from local to org-only.
- Apex Test Explorer retained `FooTest` and its two methods. Selecting a method opened the ephemeral `sf-org-metadata:` document with the download CodeLens.
- Download retrieved both source files and immediately opened the local file.
- The retrieve Effect completed successfully. `OrgMetadataCatalogRecorder.recordOperation` reported `operation: retrieve`, `changedCount: 1`, `affectedTypeCount: 1`, and `persistenceQueued: true` for org `00DWL00000DER2V2AX`.
- The restored local files exist at `force-app/main/default/classes/FooTest.cls` and `FooTest.cls-meta.xml`.
- The current Apex inventory contains exactly one `FooTest` component, and no remote tracking observation was introduced for it.
- Org Browser briefly refreshed after the retrieve and then rendered `FooTest` as local. This is consistent with the successful operation/workspace correlation, though the visual refresh was noticeable.
- Apex Test Explorer contained only one `FooTest` entry after download, confirming the duplicate-entry regression did not recur.
- The Test Explorer tree did not collapse and reopen after download.
- Final item 8 result: **PASS**

## 9. Deploy Capture

Validates successful deployment invalidates OMC before the provider operation returns.

### Actions

- [x] Expand `ApexClass` in Org Browser so its inventory is present.
- [x] Modify an existing Apex class locally.
- [x] Run `SFDX: Deploy This Source to Org`.
- [x] Immediately refresh or revisit `ApexClass` in Org Browser.
- [x] Inspect the catalog after persistence settles.

### Expected results

- [x] Deployment succeeds normally.
- [x] The affected inventory is invalidated and subsequently reacquired.
- [x] Org Browser shows the correct component presence.
- [x] An old tracking observation for the exact component is removed.
- [x] Unrelated metadata-type inventory remains stable.
- [x] Disk persistence may complete after deployment, but in-memory state is already coherent.

### Component deployed

- `ApexClass/FooTest`

### Evidence/notes

- Clean pre-deploy UI baseline: source-tracking status bar reported `0` remote and `0` local changes.
- OMC baseline: generation `326`, written at `2026-08-06T18:05:59.183Z`, file modification time `2026-08-06 12:05:59 MDT`.
- Baseline `ApexClass` inventory contained ten components and was observed at `2026-08-06T18:05:58.929Z`.
- OMC retained one raw `Profile/Admin` tracking observation. Recent recorder spans consistently report `observationCount: 1` and `changedCount: 0`; the status bar excludes that raw provider observation from its actionable `0/0` display. This does not interfere with isolating an Apex deployment.
- Unrelated-inventory baselines: `CustomField` 33 components, `CustomObject` 278 components, and `Layout` 191 components.
- Saving the local class displayed the Org Browser busy indicator without changing, collapsing, or thrashing visible nodes.
- `SFDX: Deploy This Source to Org` completed successfully for `FooTest.cls` and its metadata sidecar. Completion again displayed the busy indicator without changing, collapsing, or thrashing visible nodes.
- The operation publisher normalized the two source files to one component. `OrgMetadataCatalogRecorder.recordOperation` reported `operation: deploy`, `changedCount: 1`, `affectedTypeCount: 1`, and `persistenceQueued: true`.
- The `ApexClass` provider listing was reacquired at `2026-08-06T18:11:12.678Z` and retained ten components.
- No `FooTest` tracking observation remained; only the pre-existing raw `Profile/Admin` observation was present.
- Expanded workspace-correlated projections were recomputed after the local save, but their provider observations were not reacquired: `CustomField` remained observed at `17:34:14.303Z`, `CustomObject` at `16:37:55.545Z`, and `Layout` at `17:34:27.107Z`, with their prior counts unchanged.
- The recorder updated catalog memory and published the operation event before the deploy Effect returned; the formatted checkpoint settled afterward at generation `341`, written at `2026-08-06T18:11:14.633Z`.
- Final item 9 result: **PASS**

## 10. Delete Capture

Use a disposable component.

### Actions

- [x] Create and deploy a temporary Apex class.
- [x] Expand `ApexClass` in Org Browser and confirm the temporary class is present locally and in the org.
- [x] Delete the component from the org using the normal metadata command.
- [x] Refresh or reopen `ApexClass`.
- [x] Inspect the catalog after persistence settles.

### Expected results

- [x] The delete operation succeeds normally.
- [x] The deleted component disappears from Org Browser.
- [x] The affected Apex inventory is reacquired.
- [x] No stale tracking entry remains for the deleted component.
- [x] Unrelated metadata types remain stable.

### Component deleted

- `ApexClass/DeleteThis`

### Evidence/notes

- `DeleteThis.cls` and `DeleteThis.cls-meta.xml` are present in the workspace.
- The deploy recorder reported `operation: deploy`, `changedCount: 1`, `affectedTypeCount: 1`, and `persistenceQueued: true` for org `00DWL00000DER2V2AX`.
- The reacquired Apex provider listing and workspace-correlated inventory each contain exactly one `DeleteThis` entry and 11 Apex classes total. Its remote last-modified timestamp is `2026-08-06T18:20:24.000Z`.
- No pre-existing `DeleteThis` tracking observation is present.
- Pre-delete catalog baseline: generation `361`, written at `2026-08-06T18:20:31.535Z`.
- `SFDX: Delete from Project and Org` completed successfully. The operation publisher and recorder each normalized the deletion to one component; the recorder reported `operation: delete`, `changedCount: 1`, `affectedTypeCount: 1`, and `persistenceQueued: true`.
- Both local `DeleteThis` files are absent.
- The reacquired Apex listing and inventory contain ten components and no `DeleteThis` entry. The Apex provider listing was observed at `2026-08-06T18:22:12.896Z`.
- No stale `DeleteThis` tracking observation exists.
- Unrelated provider observations remained unchanged: `CustomField` at `2026-08-06T17:34:14.303Z`, `CustomObject` at `2026-08-06T16:37:55.545Z`, and `Layout` at `2026-08-06T17:34:27.107Z`.
- The post-delete checkpoint settled at generation `370`, written at `2026-08-06T18:22:16.539Z`.
- `DeleteThis` disappeared from the expanded Org Browser tree after deletion.
- Final item 10 result: **PASS**

## 11. Diff and Shadow Retrieve

Validates diff uses current retrieve results rather than treating OMC as an acquisition gate.

### Actions

- [x] Change an Apex class directly in the org.
- [x] Immediately run the source diff command against the local class.
- [x] Do not wait for periodic source tracking.
- [x] Run a folder-level diff against multiple components.

### Expected results

- [x] The first diff retrieves current remote content and displays the difference.
- [x] The first diff does not incorrectly report no changes.
- [x] Folder-level diff produces a grouped retrieval notification.
- [x] It does not produce one retrieval notification per component.
- [x] Retrieved shadow source does not become a normal workspace artifact.

### Evidence/notes

- Test component: `ApexClass/FooTest`.
- The class was changed directly in the org and diff was invoked immediately, before waiting for the periodic source-tracking interval.
- The first diff opened with the correct remote/local changes. It did not incorrectly report that nothing changed.
- The source-tracking status bar updated immediately after the operation.
- OMC recorded `ApexClass/FooTest` as a remote modification at revision 271 with remote timestamp `2026-08-06T18:26:31.000Z`.
- The current Apex provider listing contains the updated remote timestamp and was observed at `2026-08-06T18:26:40.872Z`.
- Diff source was published under `.sf/orgs/00DWL00000DER2V2AX/metadata-shadow/ApexClass/FooTest/revisions/2026-08-06T18%3A26%3A31.000Z/`; it did not overwrite or create an additional normal workspace artifact.
- Single-component freshness and shadow isolation pass.
- Folder-level diff on `classes` issued one grouped retrieve for all ten Apex classes and opened the single actual difference for `FooTest`.
- The folder diff took approximately 34.79 seconds. Effect spans attribute approximately 34.49 seconds to the single Salesforce retrieve API call. Batch shadow preparation took approximately 1.4 ms, and local staging/publication after the response took only a few hundred milliseconds.
- The long latency was therefore upstream retrieve time, not ten sequential requests or OMC/shadow processing overhead.
- Final item 11 result: **PASS**, with external retrieve latency noted.

## 12. Unchanged-Result Persistence

Validates successful cache hits pass through the recorder without unnecessary disk writes.

### Actions

- [x] Wait for current catalog activity to settle.
- [x] Record `generation` and file modification time.
- [x] Reopen Org Browser.
- [x] Expand already-cached types.
- [x] Repeat the same source-status request.
- [x] Request completion for the same SObject.
- [x] Record `generation` and modification time again.

### Expected results

- [x] Unchanged provider results do not increment `generation`.
- [x] Unchanged provider results do not rewrite `catalog.json`.
- [x] The catalog file does not continually disappear and reappear.
- [x] Cached provider-backed UI behavior remains correct.

### Before/after generation and modification time

Before:

- Org: `00DWL00000DER2V2AX`
- Schema version: `2`
- Generation: `387`
- Written at: `2026-08-06T18:29:13.471Z`
- File modification time: `2026-08-06 12:29:13 MDT` (`1786040953` epoch seconds)
- Snapshot size: 31,244,597 bytes
- State counts: 192 metadata types, 10 metadata listings, 2 projected inventories, 733 SObject descriptions, and 2 tracking observations

After:

- Operation-local generation: `422`
- Written at: `2026-08-06T18:41:05.507Z`
- File modification time: `2026-08-06 12:41:05 MDT` (`1786041665` epoch seconds)
- Snapshot size: 31,164,340 bytes

### Evidence/notes

- The catalog was observed stable before capturing this baseline.
- Org Browser was hidden and reopened multiple times. Expanded-node state and the last selected node were restored correctly.
- The initial baseline contained only `CustomObject` and `CustomField` projections. Restoring the saved tree state also restored expanded `ApexClass`, legitimately materializing its missing projection and advancing generation from 387 to 391.
- After restored-state materialization settled, generation was `391`, the catalog was written at `2026-08-06T18:32:02.095Z`, file modification time was `2026-08-06 12:32:02 MDT`, and size was 31,247,364 bytes. This is the reset comparison baseline for the repeated source-status and SOQL provider requests.
- After a cold restart, Org Browser did not restore expanded nodes or the last selected node. This is a native tree-view state-restoration concern and is deferred for work beyond OMC verification.
- The cold-start snapshot reached generation `417`, written at `2026-08-06T18:36:59.600Z`, and contained no projected inventories. Startup spans show Org Browser intentionally processing the initial target-org emission through root `invalidateForNode`, which calls `catalog.refresh({})` and reacquires projections on demand. This is treated as designed refresh behavior, not an OMC persistence defect.
- Normalized observations survived the restart. SOQL completion for `AccountFeed` continued to work, its single cached description retained `rest-api` provenance and 17 fields, and its `observedAt` value remained unchanged at `2026-08-06T17:18:21.213Z`.
- The startup invalidation is separate from unchanged-provider recording. Generation `417` is the new settled baseline for the remaining repeated source-status comparison.
- Additional background startup work settled at generation `422` before the manual source-status command began. The catalog checkpoint completed at `18:41:05.507Z`; the command's two source-tracking recorder spans began later and both reported `observationCount: 2`, `changedCount: 0`, and `affectedTypeCount: 0`.
- The catalog remained at generation `422`, timestamp `18:41:05.507Z`, and size 31,164,340 bytes after the command. Therefore the repeated source-status result did not queue persistence or publish a visible Org Browser change.
- Repeated `AccountFeed` completion retained its original `observedAt` value and did not duplicate or rewrite the cached description.
- Final item 12 result: **PASS** for unchanged provider-result deduplication. Cold-start native tree state restoration remains deferred as `OB-MV-001`.

## 13. Failed Operation

Validates provider failures are not recorded.

### Actions

- [x] Record catalog generation and modification time.
- [x] Introduce an intentionally invalid Apex change.
- [x] Attempt deployment.
- [x] Record catalog generation and modification time again.
- [x] Revert the intentionally invalid local change.

### Expected results

- [x] Deployment fails through its normal error channel.
- [x] The failed operation is not recorded as a successful observation or mutation.
- [x] `catalog.json` is not rewritten because of the failed operation.
- [x] Existing catalog state remains usable.

### Before/after generation and modification time

Before failed-deploy test:

- Generation: `422`
- Written at: `2026-08-06T18:41:05.507Z`
- File modification time: `2026-08-06 12:41:05 MDT`
- Snapshot size: 31,164,340 bytes

After introducing the invalid edit but before the failed deploy:

- Generation: `424`
- Written at: `2026-08-06T18:43:43.255Z`
- File modification time: `2026-08-06 12:43:43 MDT`
- Snapshot size: 31,164,340 bytes

After failed deploy:

- Generation: `424` (unchanged)
- Written at: `2026-08-06T18:43:43.255Z` (unchanged)
- File modification time: `2026-08-06 12:43:43 MDT` (unchanged)
- Snapshot size: 31,164,340 bytes (unchanged)


### Evidence/notes

- The generation change from 422 to 424 occurred while saving the invalid workspace edit, before deployment, and is not attributed to the failed provider operation.
- The deploy began at approximately `2026-08-06T18:43:53.623Z`, about ten seconds after the final catalog checkpoint, and returned the expected failure.
- No successful `MetadataDeployService.publishDeployNotifications` or `OrgMetadataCatalogRecorder.recordOperation` span followed the failed deploy.
- OMC tracking and normalized cached state remained readable and unchanged after the failure.
- The invalid edit was reverted and a subsequent deploy succeeded. That later operation produced its own success notification and `OrgMetadataCatalogRecorder.recordOperation` span with `operation: deploy`, `changedCount: 1`, and `affectedTypeCount: 1`, cleanly separated from the earlier failed attempt.
- Final item 13 result: **PASS**

## 14. Org Isolation

Validates the authoritative org ID is shared by connections, caches, and the recorder.

### Actions

- [x] Record the current org ID and catalog path.
- [x] Switch the default org.
- [x] Open Org Browser or run SObject refresh against the new org.
- [x] Inspect `.sf/orgs` for the new catalog.
- [x] Switch back to the original org.
- [x] Reopen Org Browser and inspect the restored state.

### Expected results

- [x] The new org has its own `<ORG_ID>/metadata-catalog/catalog.json`.
- [x] Metadata components are not mixed between orgs.
- [x] SObject observations are not mixed between orgs.
- [x] Returning to the original org restores its independent catalog state.

### Second org alias and ID

- Original org: `00DWL00000DER2V2AX`
- Original catalog: `.sf/orgs/00DWL00000DER2V2AX/metadata-catalog/catalog.json`
- Second org alias: `dreamhouselwcclean-2`
- Second org ID: `00DRu00000VgOwvMAF`
- Second catalog: `.sf/orgs/00DRu00000VgOwvMAF/metadata-catalog/catalog.json`

### Previous-run evidence (2026-08-06)

- A new scratch org was created in the same workspace, made the default org, and used to open Org Browser and run Refresh All SObjects.
- The second catalog is schema version 2, generation 70, and was written at `2026-08-06T18:49:22.134Z`.
- It contains 192 metadata types, no acquired metadata listings or projected inventories, no tracking observations, and 1,389 SObject list entries/descriptions.
- All 1,389 SObject descriptions are keyed to org `00DRu00000VgOwvMAF`; none carries the original org ID.
- The fresh org contains neither `Broker__c` nor `Property__c`, no `FooTest` metadata listing, and no original-org tracking state.
- The original catalog remains separately present at generation 438 with its own ten metadata listings, 733 SObject descriptions, `Broker__c`, `Property__c`, `FooTest`, and one tracking observation. Every original description remains keyed to `00DWL00000DER2V2AX`.
- After switching back, workspace configuration again targeted alias `dreamhouselwcclean`. The restored original catalog was generation 443 and retained ten metadata listings, 733 SObject descriptions, its tracking observation, `Broker__c`, `Property__c`, and `FooTest`, with no mismatched SObject org IDs.
- The second catalog remained separately intact with 1,389 SObject descriptions, no original custom objects, no `FooTest`, no tracking observations, and no mismatched SObject org IDs.
- Final item 14 result: **PASS**

### Retest evidence (2026-08-07)

- Workspace: `/Users/peter.hale/git/dreamhouse-lwc-clean`
- Current target-org alias (org A): `dreamhouselwcclean-2`
- Current org A ID: `00DRu00000VgOwvMAF`
- Org A catalog: `.sf/orgs/00DRu00000VgOwvMAF/metadata-catalog/catalog.json`
- Org A baseline: schema version 2, generation `293`, written at `2026-08-07T12:40:50.762Z`, file modification time `2026-08-07 06:40:54 MDT`, and size 42,276,288 bytes.
- Org A contents: 192 metadata types, eight metadata listings, no projected inventories, 1,397 SObject descriptions, and one tracking observation.
- Candidate org B ID: `00DWL00000DER2V2AX`; its independent catalog baseline remains present at generation `448`, with ten metadata listings, one projected inventory, 733 SObject descriptions, and one tracking observation.
- Switched from org A to org B. After the switch, org A was generation `309`, written at `2026-08-07T12:44:41.263Z` with file modification time `2026-08-07 06:44:41 MDT`; org B was generation `460`, written at `2026-08-07T12:44:50.943Z` with file modification time `2026-08-07 06:44:51 MDT`.
- Both org-specific snapshot paths remain present. All 1,397 org A SObject descriptions carry org A's ID, and all 733 org B descriptions carry org B's ID; neither snapshot contains a mismatched description org ID.
- Metadata observations remain independent: org B retains `FooTest`, while org A does not. Both orgs now contain the deployed Dreamhouse objects, so `Broker__c` and `Property__c` are no longer useful isolation discriminators.
- The exported telemetry includes successful catalog saves after both switches and refreshes, but no `OrgMetadataCatalog.closeOrg` span. Because later spans from the same process have exported, this can no longer be attributed confidently to buffering; close-path execution and ordering remain unproven.
- Org Browser was refreshed against org B and then refreshed again after switching back to org A. The project target returned to `dreamhouselwcclean-2`.
- After both refreshes, org A was generation `314`, written at `2026-08-07T12:50:07.517Z`, with 1,397 correctly keyed SObject descriptions, eight listings, and no `FooTest`. Org B was generation `465`, written at `2026-08-07T12:49:45.683Z`, with 733 correctly keyed descriptions, ten listings, and `FooTest` retained.
- No SObject description in either catalog carries the other org's ID. Final item 14 retest result: **PASS**.

## 15. Persistence Burst and Shutdown

Validates persistence coalescing and dirty-state flushing.

### Actions

- [x] Record catalog generation and modification time.
- [x] Quickly expand several previously unobserved metadata types.
- [x] Watch the metadata-catalog directory for approximately five seconds.
- [x] Verify the file settles after the burst rather than continuously rewriting.
- [x] Perform one final catalog-changing discovery.
- [x] Close the Extension Development Host normally.
- [x] Reopen it and inspect the restored snapshot.

### Expected results

- [x] A burst does not cause a continuous refresh storm.
- [x] `catalog.json` remains formatted and readable.
- [x] Dirty state is flushed during service shutdown.
- [x] Version 2 state restores after restart.
- [x] Org Browser and other consumers work from the restored state.

### Previous-run evidence (2026-08-06)

- Test org: `00DRu00000VgOwvMAF` (`dreamhouselwcclean-2`).
- Before restarting, the org-specific folder was manually removed while its catalog state had previously been loaded. The catalog was recreated by the time the Extension Development Host started, consistent with shutdown flushing/restoration of service-owned state rather than dependence on Org Browser activation.
- Org Browser was closed when the baseline was captured.
- Baseline catalog: schema version 2, generation `96`, written at `2026-08-06T18:57:23.805Z`, file modification time `2026-08-06 12:57:24 MDT`, and size 42,047,723 bytes.
- Baseline contents: 192 metadata types, one empty `ApexClass` provider listing retained from the prior session, no projected inventories, 1,389 SObject list entries/descriptions, and no tracking observations.
- Rapid Org Browser expansion acquired `ApexPage` (0 components), `AppMenu` (2), `AuraDefinitionBundle` (0), and `CustomObject` (276), while also materializing the cached empty `ApexClass` projection.
- The snapshot settled at generation `107`, written at `2026-08-06T19:00:30.197Z`, file modification time `2026-08-06 13:00:30 MDT`, and size 42,181,981 bytes.
- JSON validation succeeded, and the file remained formatted and readable.
- Each provider response queued its listing and projection changes together; after the rapid expansion sequence, writes stopped rather than continuing as a refresh storm.
- Immediately before shutdown, `ApexTrigger` and `ApexTestSuite` were acquired as final catalog-changing discoveries. Their provider observations were recorded at `2026-08-06T19:02:39.012Z` and `2026-08-06T19:02:42.978Z`, respectively.
- After normal Extension Development Host shutdown and restart, both observations were present with those same timestamps. This proves dirty normalized state was flushed and subsequently restored rather than reacquired with new timestamps.
- The restored schema version 2 snapshot contains 192 metadata types, seven metadata listings, 1,389 SObject list entries/descriptions, and no tracking observations.
- The startup root refresh cleared projected inventories as designed while retaining normalized provider observations.
- Post-restart snapshot: generation `123`, written at `2026-08-06T19:03:16.369Z`, file modification time `2026-08-06 13:03:16 MDT`, and size 42,110,389 bytes.
- The restored snapshot remains formatted and passes JSON validation.
- After restart, Org Browser successfully expanded `ApexTrigger` from its restored empty provider listing. The listing retained its original `2026-08-06T19:02:39.012Z` timestamp, confirming it was reused rather than reacquired.
- SOQL completion for `AccountFeed` worked after restart. Exactly one description remained, keyed to `00DRu00000VgOwvMAF`, with its original `2026-08-06T18:48:48.030Z` observation, `rest-api` provenance, and 17 fields.
- Final item 15 result: **PASS**

### Retest evidence (2026-08-07)

- Workspace: `/Users/peter.hale/git/dreamhouse-lwc-clean`.
- The `.sf/orgs` directory was reset before the retest. The Extension Development Host was then started with Org Browser still closed and project target-org alias `dreamhouselwcclean`, resolving to org `00DWL00000DER2V2AX`.
- Before Org Browser activation, the host recreated `.sf/orgs/00DWL00000DER2V2AX/metadata-catalog/catalog.json` as a formatted schema-version-2 snapshot.
- Baseline snapshot: generation `16`, written at `2026-08-07T13:00:59.538Z`, file modification time `2026-08-07 07:00:59 MDT`, and size 18,927 bytes.
- Baseline contents: no metadata types, metadata listings, projected inventories, SObject list, or SObject descriptions; 97 source-tracking observations were captured independently of Org Browser.
- A repeated read after the host settled showed the same generation, timestamp, modification time, and size. The pre-browser catalog was not continuously rewriting.
- Org Browser was opened and several previously undiscovered types were expanded in a concentrated sequence, including types with components and empty types.
- The acquisition burst settled at generation `31`, written at `2026-08-07T13:04:03.982Z`, file modification time `2026-08-07 07:04:03 MDT`, and size 209,179 bytes.
- The snapshot contains 192 metadata types plus seven listings and seven matching inventories: `AnimationRule` (0 components), `ApexClass` (10), `ApexPage` (0), `ApexTrigger` (0), `CustomLabels` (1), `CustomMetadata` (0), and `CustomObject` (278).
- After a further six-second observation window, generation, written timestamp, file modification time, size, listing count, and inventory count were unchanged. No persistence storm continued after the burst.
- `jq empty` validated the JSON, and inspection confirmed the snapshot remains formatted and readable.
- During the first final-discovery attempt, the user accepted an `Aur*` filter, then expanded the sole visible `AuraDefinitionBundle` row. The host trace instead recorded `getChildrenOfTreeItem` with `element=ActionLinkGroupTemplate`, requested `ActionLinkGroupTemplate`, and recorded an empty listing under that key. The filtered Aura row was replaced by the empty-tree message.
- Repeating the same actions more deliberately on the same unchanged Extension Development Host succeeded: the trace dispatched `AuraDefinitionBundle`, the tree displayed its `pageTemplate_2_7_3` child, and OMC recorded the matching provider listing and inventory.
- The durable shutdown marker is now the `AuraDefinitionBundle` listing observed at `2026-08-07T13:24:37.026Z`, containing `pageTemplate_2_7_3`. The snapshot reached generation `48`, written at `2026-08-07T13:24:37.280Z`, with the matching inventory present.
- After normal host reload, the schema-version-2 snapshot restored the Aura listing with the exact original `2026-08-07T13:24:37.026Z` provider timestamp and `pageTemplate_2_7_3` component. Its inventory was rebuilt at `2026-08-07T13:33:29.392Z`, proving normalized observation restoration rather than provider reacquisition.
- The post-reload catalog was generation `65`, written at `2026-08-07T13:33:29.655Z`, with nine retained normalized listings and the current Aura projection. Org Browser rendered the restored Aura child correctly.
- The manual run alone does not isolate a dirty-at-shutdown checkpoint: the Aura observation was already visible in the on-disk generation-48 snapshot before shutdown, and the old process did not export a final save span that proves additional dirty state was flushed. Deterministic scoped-service coverage below supplies that remaining evidence.
- A later host cycle occurred with default org `00DRu00000VgOwvMAF` active. Process `39355` exported the Org Browser deactivation span but no catalog save at shutdown, consistent with an empty dirty set rather than an attempted redundant checkpoint.
- After restart, org B (`00DWL00000DER2V2AX`) remained independently unchanged at generation `79`, written at `2026-08-07T13:36:17.269Z`, with its nine listings and restored Aura observation. The active org A snapshot advanced independently to generation `43`, with 192 metadata types, no listings or inventories, and 96 tracking observations. This cycle reinforces clean-shutdown deduplication and org isolation, but still does not exercise dirty-state finalization.
- Deterministic scoped-service coverage now closes the dirty-finalizer gap. `orgCatalogState.test.ts` queues dirty state and ends the service scope before the 250 ms debounce can elapse, proving the finalizer saves the normalized observation. Companion cases prove every dirty org is saved exactly once and a clean hydrated org performs no shutdown write.
- Focused result: all five `OrgCatalogState` tests pass, including the three shutdown-finalizer cases. Final item 15 retest result: **PASS**.

## 16. Org-Switch Flush

Validates the org-switch lifecycle handling added in `0100ad37d`: `OrgMetadataCatalog.closeOrg()`, wired to `TargetOrgRef.changes`, flushes the previously tracked org's catalog state via `state.persistOrg()` when the listener observes a different org ID.

This listener does not establish a global ordering boundary before the new org becomes active. `TargetOrgRef` has already emitted the new value, and other subscribers may react concurrently; the verification scope is the previous-org flush performed by this listener.

`closeOrg` now atomically claims and persists only dirty state. A clean org switch must leave the outgoing snapshot's generation and modification time unchanged. If the debounce worker already claimed pending state, it remains responsible for that checkpoint; the close path does not create a duplicate write.

Run the clean-close check with Org Browser closed. Opening Org Browser intentionally refreshes metadata for the active org because its persisted catalog may have become stale while another org was active. Likewise, use a single A → B switch and inspect only outgoing org A; switching back makes A active and intentionally refreshes it, invalidating the no-op premise.

### Actions

- [x] Switch the default org from org A to org B.
- [x] Inspect the output channel for the org-change log line.
- [x] Reload/start the Extension Development Host fresh (no prior org active) and confirm no spurious close-org activity occurs on the first org emission.
- [x] Switch the default org from org A to org B when org A has no pending/dirty catalog state.
- [x] Inspect org A's `catalog.json` generation and modification time after the no-op switch.

### Expected results

- [x] The output channel logs `Target org changed to <B>; closing previous org <A>` at the moment of switch.
- [x] On first activation, with no previous org tracked, no `closeOrg` call or "closing previous org" log line occurs.
- [x] The no-op switch (org A has no pending changes) succeeds without error.
- [x] A metadata discovery superseded by an org switch is discarded silently; no error or informational notification appears.
- [x] Record the original behavior: org A's `generation` advanced and `catalog.json` was rewritten on a no-op switch, establishing the clean-checkpoint regression that prompted the dirty-aware `closeOrg` change.
- [x] With Org Browser closed, repeat one settled A → B switch and confirm outgoing org A's generation and modification time do not change. Do not switch back before capturing the result.

### Evidence/notes

- Switched from `00DRu00000VgOwvMAF` to `00DWL00000DER2V2AX` on 2026-08-07.
- The Salesforce Services output channel logged `Target org changed to 00DWL00000DER2V2AX; closing previous org 00DRu00000VgOwvMAF`.
- Org A advanced from the stable baseline generation `293` to `309`; org B advanced from `448` to `460`. Because catalog acquisition occurred around the switch, this run does not isolate the single unconditional `closeOrg` write and does not yet satisfy the separate no-op-switch check.
- Later `OrgMetadataCatalog.refresh`, `OrgMetadataCatalog.persistOrg`, and `OrgMetadataCatalogStore.save` spans from the same process exported for both orgs, but no `OrgMetadataCatalog.closeOrg` span appeared after either switch. The output line is emitted before `yield* catalog.closeOrg(previousOrgId)`, so it proves branch entry but not close completion. Treat the missing span as an instrumentation or execution-path defect until diagnosed.
- After reloading with the output-channel fix, process `98034` reproduced the result during another org switch and Org Browser refresh sequence: ordinary refresh/persist/save spans exported for both orgs, but no `OrgMetadataCatalog.closeOrg` span exported. This rules out a stale Extension Development Host as the cause.
- A subsequent clean host start logged `Target org changed to <NOT SET>` followed by `Target org changed to 00DWL00000DER2V2AX`. Neither line included `closing previous org`, confirming the initial unset-to-resolved transition does not invoke the previous-org close branch.
- Before another switch attempt, `.sf/orgs` was removed. Both org-specific snapshots were recreated successfully and remained isolated, but provider/status reacquisition caused multiple writes, so that run cannot satisfy the no-op-switch condition. No `OrgMetadataCatalog.closeOrg` span exported during this attempt either.
- After recovery settled, org A (`00DRu00000VgOwvMAF`) was generation `23`, written at `2026-08-07T14:06:18.799Z`, with 192 metadata types and 96 tracking observations. Org B (`00DWL00000DER2V2AX`) was generation `23`, written at `2026-08-07T14:08:16.640Z`, with 192 metadata types and 97 tracking observations. Neither contained listings or inventories, and both remained unchanged across a subsequent six-second read.
- A subsequent cold-start attempt opened Org Browser, waited at least five seconds, and switched orgs. The first switch displayed `The active org changed while an operation for '00DWL00000DER2V2AX' was in progress`; later switches did not display it.
- Trace process `76906` shows an Org Browser root `getChildren` request captured the outgoing org ID, then `MetadataDescribeService.getConnectionForOrg` correctly rejected it after the active connection changed. This was expected stale-request cancellation incorrectly surfaced as a user notification, not cross-org catalog capture.
- Org Browser now catches only `InactiveOrgOperationError` at its tree boundary, annotates the request as `supersededByOrgChange`, and returns no stale children while the independent target-org refresh loads the new root. It deliberately does not retry the outgoing org's request against the new org. The outgoing org retains its completed catalog observations and reacquires any missing slice on later consumer demand after it becomes active again. Compilation and all 15 focused provider tests pass; manual verification after reload remains.
- Because the cold start and repeated switches advanced org A to generation `41` and org B to `50`, this attempt also does not isolate the single no-op close checkpoint.
- After rebuilding the superseded-request handling, a rapid-switch stress run launched the host, opened Org Browser, immediately switched orgs, allowed the tree to refresh, then immediately switched and refreshed again. No notifications appeared. The final target was `dreamhouselwcclean` (`00DWL00000DER2V2AX`). Org A persisted generation `66` at `2026-08-07T14:24:48.903Z` with 192 metadata types and 96 tracking observations; org B persisted generation `68` at `2026-08-07T14:24:49.063Z` with 192 metadata types and 97 tracking observations. Both had zero metadata listings, inventories, SObject summaries, and SObject descriptions, which is consistent with root-only Org Browser refreshes. The snapshot `orgId` values matched their directory partitions; no cross-org observations were found.
- The subsequent settled-state switch changed the target to `dreamhouselwcclean-2` (`00DRu00000VgOwvMAF`). The outgoing `00DWL00000DER2V2AX` snapshot advanced from generation `68` at `2026-08-07T14:24:49.063Z` to generation `74` at `2026-08-07T14:33:52.213Z`, despite retaining the same 192 metadata types, 97 tracking observations, and zero listings, inventories, SObject summaries, and SObject descriptions. The incoming org also wrote generation `70` at `2026-08-07T14:33:52.367Z`. This confirms the unconditional clean-state rewrite and leaves a follow-up to gate `closeOrg` persistence on dirty state.
- `closeOrg` now delegates to an atomic dirty-only `OrgCatalogState.flushOrg`. Focused tests prove a clean explicit flush performs no save, a dirty explicit flush saves exactly once, a clean catalog close performs no save, and a dirty catalog close saves once before returning. Manual no-op-switch verification after rebuilding remains.
- The post-fix no-op baseline was captured after launching the host and opening Org Browser for active org `00DRu00000VgOwvMAF`. After a further three-second settling interval, its snapshot remained generation `88`, written at `2026-08-07T14:39:24.294Z`, filesystem mtime epoch `1786113564`, size `65216`, and SHA-256 `d31ca3dea619800c402496f70aa8726de03ac31dd3b7016c6e85b73ba3197186`. The inactive `00DWL00000DER2V2AX` baseline was generation `74`, written at `2026-08-07T14:33:52.213Z`, mtime epoch `1786113232`, size `65369`, and SHA-256 `6a63594f388b3524502c07556482740a9dc68cafe6e42479e1a3e053e050407c`.
- The first post-fix switch sequence advanced `00DRu00000VgOwvMAF` to generation `94` and `00DWL00000DER2V2AX` to generation `86` with unchanged counts. This does not test a clean close: Org Browser was open and intentionally refreshed each incoming org, and the A → B → A sequence made both orgs incoming. The attempted change that reduced target-org handling to a cached tree re-render was rejected because catalog data may be stale after an org has been inactive; Org Browser retains its existing refresh-on-target-change behavior. A valid clean-close check must keep Org Browser closed, switch only once, and inspect the outgoing org before switching back.
- A valid cold-start baseline was captured without opening Org Browser. Active org A `00DRu00000VgOwvMAF` remained generation `124`, written at `2026-08-07T14:52:26.175Z`, mtime epoch `1786114346`, size `65217`, and SHA-256 `e1c196907cd678872a82853817e4e6bc720846ec980dae1eebc6f4749c4ff420` across a three-second settling check. Inactive org B `00DWL00000DER2V2AX` remained generation `86`, written at `2026-08-07T14:40:57.948Z`, mtime epoch `1786113657`, size `65369`, and SHA-256 `494c55b9b06b2f1401a05f898b19737680c38d0eabd6301f8e599c2c40b152f4`.
- The check following that baseline was inconclusive because the configured target was still org A alias `dreamhouselwcclean-2`, rather than org B alias `dreamhouselwcclean`. Org A had advanced to generation `129` and org B to generation `96`, so either no effective one-way switch occurred or the sequence returned to A and made both orgs active. Repeat from a new stable baseline with one explicit switch to `dreamhouselwcclean`, then inspect before any switch back.
- The valid one-way switch changed the target from org A alias `dreamhouselwcclean-2` to org B alias `dreamhouselwcclean`. Org A advanced independently from the earlier generation-129 baseline to generation `131` at `2026-08-07T14:54:58.836Z`, but trace timing shows that write completed about 22 seconds before the target change was observed at approximately `2026-08-07T14:55:20Z`. After the switch, outgoing org A remained generation `131`, mtime epoch `1786114498`, size `65217`, and SHA-256 `c94540c321391e76c0c91391022c7e7b7e68efbed372f4f1e1ee804e0725a4b4`; a later stability read was identical. Incoming org B wrote generation `102` at `2026-08-07T14:55:25.123Z`, which is allowed because becoming active can trigger fresh provider observations. This passes the dirty-aware no-op `closeOrg` check.

## Final Result

- [x] Metadata type discovery passed.
- [x] Metadata listing discovery passed.
- [x] Foldered metadata passed.
- [x] SObject refresh passed.
- [x] SOQL discovery passed.
- [x] Source tracking passed.
- [x] Apex test download passed.
- [x] Deploy passed.
- [x] Delete passed.
- [x] Diff passed.
- [x] Persistence deduplication passed.
- [x] Failed-operation behavior passed.
- [x] Org isolation passed.
- [x] Persistence burst and restoration passed.
- [ ] Org-switch flush passed.

Overall result:

- [ ] PASS
- [ ] PASS WITH FOLLOW-UP
- [ ] FAIL

## Defects and Follow-Ups

| ID | Test | Description | Evidence | Status |
| --- | --- | --- | --- | --- |
| OMC-MV-002 | 2. Metadata Listing Discovery | A local Custom Object initially displayed no child fields. | Test setup: the `dreamhouse` permission set had not been assigned. After assignment, direct REST Describe and OMC contained all seven custom fields and Org Browser rendered them. | Closed |
| OMC-MV-003 | 3. Foldered Metadata | Expanding a valid empty Report folder threw `FileNotADirectory` and displayed an unhelpful notification containing only the folder name. | Fixed and manually verified: all five folders now open without errors; empty folders return no children and `unfiled$public` returns six reports. | Closed |
| OMC-MV-004 | 16. Org-Switch Flush | No `OrgMetadataCatalog.closeOrg` span is exported even though the org-change branch runs and the previous-org snapshot is checkpointed. | Later spans from process `75845` exported normally. The switch-only generation-465 checkpoint has no corresponding close, persist, or save span, indicating the background lifecycle trace is not exported. | Open |
| OMC-MV-005 | 16. Org-Switch Flush | The Salesforce Services output channel was repeatedly populated with serialized `watchDefaultOrgContext` snapshots. | Removed the debug `Stream.tap` and unused `ChannelService` dependency from `vscode/context.ts`. Focused Jest and service compilation passed, and a host reload plus repeated org switches confirmed the messages no longer appear. | Closed |
| OB-MV-001 | Follow-up outside OMC | Cold start does not restore Org Browser expansion or last-selected-node state. | Root refresh is working as designed and does not inherently prevent native tree state restoration. Stable normalized OMC observations restored correctly, and cached `AccountFeed` completion continued to work. | Deferred |
| OB-MV-002 | 15. Persistence Burst and Shutdown | After accepting and saving an `Aur*` type filter, a rapid expansion of the sole visible `AuraDefinitionBundle` row was routed as `ActionLinkGroupTemplate`; repeating the actions slowly on the unchanged host routed Aura correctly. | Root type elements are now retained by XML name across filtering and catalog refreshes. Post-fix process `39355` returned root ID/label `AuraDefinitionBundle`, then expanded ID/label/XML name `AuraDefinitionBundle`; the correct child rendered. Compilation and all 14 focused tests pass. | Closed |
| OB-MV-003 | 16. Org-Switch Flush | Switching orgs while an Org Browser root request was still resolving displayed an `InactiveOrgOperationError` notification. | The connection guard correctly rejected a request bound to the outgoing org. Org Browser now silently discards that superseded request without retrying it against the incoming org; the target-org watcher independently refreshes the new tree. Rapid back-to-back switches refreshed correctly with no notification, and persisted catalog partitions remained isolated. Compilation and all 15 focused tests pass. | Closed |

## Additional Notes

- Snapshot health check after item 3 used org `00DWL00000DER2V2AX`, schema version 2, generation 112, and a 151,392-byte snapshot.
- The snapshot contained 192 metadata types, nine distinct metadata listings, one current projected inventory, one SObject description, and one tracking observation.
- No duplicate metadata types, listing keys, inventory types, or SObject descriptions were found.
- No malformed metadata-type observations were found.
- Report folder membership, folder-specific listings, and the Report inventory were mutually consistent.
- A root refresh correctly invalidated previously projected inventories such as `CustomField` while retaining its normalized provider listing and `Broker__c` REST description. This explains why the current snapshot has a Report inventory but no current CustomField inventory.
- The catalog file was stable after the retest and did not continue checkpointing without additional activity.
