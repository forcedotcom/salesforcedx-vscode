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

### Evidence/notes

- A new scratch org was created in the same workspace, made the default org, and used to open Org Browser and run Refresh All SObjects.
- The second catalog is schema version 2, generation 70, and was written at `2026-08-06T18:49:22.134Z`.
- It contains 192 metadata types, no acquired metadata listings or projected inventories, no tracking observations, and 1,389 SObject list entries/descriptions.
- All 1,389 SObject descriptions are keyed to org `00DRu00000VgOwvMAF`; none carries the original org ID.
- The fresh org contains neither `Broker__c` nor `Property__c`, no `FooTest` metadata listing, and no original-org tracking state.
- The original catalog remains separately present at generation 438 with its own ten metadata listings, 733 SObject descriptions, `Broker__c`, `Property__c`, `FooTest`, and one tracking observation. Every original description remains keyed to `00DWL00000DER2V2AX`.
- After switching back, workspace configuration again targeted alias `dreamhouselwcclean`. The restored original catalog was generation 443 and retained ten metadata listings, 733 SObject descriptions, its tracking observation, `Broker__c`, `Property__c`, and `FooTest`, with no mismatched SObject org IDs.
- The second catalog remained separately intact with 1,389 SObject descriptions, no original custom objects, no `FooTest`, no tracking observations, and no mismatched SObject org IDs.
- Final item 14 result: **PASS**

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

### Evidence/notes

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

Overall result:

- [ ] PASS
- [x] PASS WITH FOLLOW-UP
- [ ] FAIL

## Defects and Follow-Ups

| ID | Test | Description | Evidence | Status |
| --- | --- | --- | --- | --- |
| OMC-MV-002 | 2. Metadata Listing Discovery | A local Custom Object initially displayed no child fields. | Test setup: the `dreamhouse` permission set had not been assigned. After assignment, direct REST Describe and OMC contained all seven custom fields and Org Browser rendered them. | Closed |
| OMC-MV-003 | 3. Foldered Metadata | Expanding a valid empty Report folder threw `FileNotADirectory` and displayed an unhelpful notification containing only the folder name. | Fixed and manually verified: all five folders now open without errors; empty folders return no children and `unfiled$public` returns six reports. | Closed |
| OB-MV-001 | Follow-up outside OMC | Cold start does not restore Org Browser expansion or last-selected-node state. | Root refresh is working as designed and does not inherently prevent native tree state restoration. Stable normalized OMC observations restored correctly, and cached `AccountFeed` completion continued to work. | Deferred |

## Additional Notes

- Snapshot health check after item 3 used org `00DWL00000DER2V2AX`, schema version 2, generation 112, and a 151,392-byte snapshot.
- The snapshot contained 192 metadata types, nine distinct metadata listings, one current projected inventory, one SObject description, and one tracking observation.
- No duplicate metadata types, listing keys, inventory types, or SObject descriptions were found.
- No malformed metadata-type observations were found.
- Report folder membership, folder-specific listings, and the Report inventory were mutually consistent.
- A root refresh correctly invalidated previously projected inventories such as `CustomField` while retaining its normalized provider listing and `Broker__c` REST description. This explains why the current snapshot has a Report inventory but no current CustomField inventory.
- The catalog file was stable after the retest and did not continue checkpointing without additional activity.
