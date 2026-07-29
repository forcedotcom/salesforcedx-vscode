# Org-Metadata VFS, Catalog & Document Resolver — Design

**Status:** IMPLEMENTED
**Date:** 2026-07-28
**Author:** Peter Hale (with Claude)
**Work item:** W-23613533 (`1 Services-owned org-data VFS: canonical presence/resolution layer`)
**Epic:** IDEx - Org Browser: Actions (`a3QEE000002V05p2AC`)
**Depends on:** W-23596477 (story 0 — `sf-org-data` scheme/provider/lifecycle; **open draft PR #7912,
not yet merged** — lives on this branch, not on `develop`)
**Base branch for stacking:** `ph/W-23596477-org-data-vfs-services` (the story-0 branch)
**Findings log (the reasoning behind every decision here):**
`docs/superpowers/specs/2026-07-28-org-metadata-vfs-findings.md`

> This is the distilled design. The findings doc records how we got here (options explored, models
> rejected, corrections made). This doc states only the destination and how to build it. Where the
> findings doc and this doc differ, **this doc wins** for implementation.

---

## 1. Goal

Make the org's metadata a **services-owned resource** that every extension consumes **one uniform
way** — through the `sf-org-data` document facade and a small catalog/resolution API — instead of each extension
re-deriving "does this component exist locally / in the org, and which URI do I open?" on its own.

Today that derivation is duplicated across at least four consumers (apex-testing, org-browser,
lwc/lightning commands, metadata diff), each computing it a different way and **throwing the result
away**. This design relocates the computation into services once, caches it, and exposes it so:

- **Org Browser** builds its tree through the catalog and opens components through the VFS document facade.
- **apex-testing** resolves and opens test-class source via the **same** facility — no consumer-specific
  presence/fetch/open code left in either.

That symmetric two-consumer proof is the success criterion.

## 2. Background (one paragraph — see findings doc for depth)

Story 0 built a services-owned, read-only, in-memory `sf-org-data` VFS
(`OrgDataFsProvider`) with owner-sharded paths `sf-org-data:/orgs/<orgId>/<owner>/<segments>` and an
editor-read-only / service-writable split. It has one populator today: apex-testing eagerly writes
discovered `.cls` bodies into an `apex-testing` owner. The Org Browser reads metadata **live** from the
org (`MetadataDescribeService`) and never touches the VFS; it computes local presence
(`filePresent`) per node and discards it. This design turns the VFS into the shared consumption
surface story 0 was built to enable.

### 2.1 Relationship to story 0 — this is a NEW LAYER, not a rewrite

Story 0 is **not merged**: it is open **draft PR #7912** on this branch (`develop` has neither the
services `orgVfs/` nor the relocation). This design **stacks on top of it and reuses it**; the
boundary:

|                                                                                                                           | Story 0 (PR #7912, W-23596477) — the foundation                                                                       | This design (new WI) — the layer on top                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Nature**                                                                                                                | _Refactor_: move org-data VFS ownership apex-testing → services                                                       | _Feature_: shared presence/resolution over that VFS                                               |
| **Provider, URI layout, lifecycle reactor, `FsService` org-data API, registry, tab-reaper, decoration/owner attribution** | **Delivers these**                                                                                                    | **Reuses verbatim**                                                                               |
| **apex-testing**                                                                                                          | Becomes a _consumer_ but **still eager-writes** class bodies (now via `FsService.writeOrgData`, not its own provider) | Converts that eager-write → lazy presence + `readFile`; collapses the `apex-testing` owner (§4.3) |
| **`org-metadata` owner + `OrgMetadataCatalog` + `OrgMetadataResolver`**                                                   | Does not exist                                                                                                        | **Adds these**                                                                                    |

**The single overlap:** this design's final slice (§8.4) _deletes_ the eager-write path story 0 just
relocated the API for. That is intended and sequenced — the `apex-testing` owner stays functional until
slice 4, because story-0's shipped code still writes to it. So the parts that _look_ like a rewrite are
apex-testing's eager-write / `sf-org-apex` code that story 0 merely **lifted-and-shifted** (it did not
invent them); deleting relocated code is cheap and does not discard the foundation. **Starting over
from `develop` would mean re-implementing and re-testing the ~471-line provider foundation this design
reuses — strictly more work, not less.**

## 3. The model (settled)

### 3.1 Canonical key + union entries

Every metadata component that exists in the org **and/or** the workspace has **one canonical VFS
path**:

```
sf-org-data:/orgs/<orgId>/org-metadata/<xmlName>/<fullName>
sf-org-data:/orgs/<orgId>/org-metadata/<folderType>/<folder>/<fullName>   (foldered types)
```

The VFS is populated with the **union** of org + workspace components (not org-only), so presence can
be answered for any component. Each component's **state** is:

```ts
type PresenceState = {
  inOrg: boolean;
  inWorkspace: boolean;
  workspaceUri?: vscode.Uri; // set when inWorkspace — where the real file lives
};
```

### 3.2 Two stores — do not conflate them

| Store                                              | What it holds                                                              | Written when                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| **Catalog cache** (`OrgMetadataCatalog`)           | rich inventory entries and `PresenceState` per canonical key, keyed by org | on demand (pull) + on presence-change events        |
| **Document-content cache** (`OrgMetadataResolver`) | transient org bytes keyed by canonical URI                                 | only on `readFile` of org-only content              |
| **Provider facade** (`OrgDataFsProvider`)          | owner dispatch and VS Code `FileSystemProvider` events                     | delegates `org-metadata` operations to the resolver |

**Presence lives in the catalog, never as provider file entries.** The provider is a
**read-through facade** over the catalog for structure and the resolver for lazy content.

### 3.3 Read-only provider; editing always via `file:`

`sf-org-data` stays **read-only** (as story 0 built it). Edits never route through the provider. The
only thing ever _opened from_ the scheme is **org-only** content — read-only, carrying a "Download into
workspace" code lens. In-workspace editing happens on the `file:` URI returned by `getUriForFile`, so
language servers, scanners, and source tracking see normal `file:` paths untouched.

> **Rejected:** a writable overlay proxying all workspace files through `sf-org-data`. Too invasive —
> background scanners/indexers/source-tracking would traverse a synthetic scheme. (Findings §9.2.)

### 3.4 Helper APIs (state the FS method set can't express)

Exposed from services alongside the provider. Catalog operations describe metadata and relationships:

```ts
OrgMetadataCatalog.isInWorkspace(canonicalUri): boolean
OrgMetadataCatalog.getPresence(canonicalUri): PresenceState
OrgMetadataCatalog.getChildren(canonicalUri): OrgMetadataInventoryEntry[]
OrgMetadataCatalog.getEntry(canonicalUri): OrgMetadataInventoryEntry | undefined
```

Document operations resolve bytes and editor targets:

```ts
OrgMetadataResolver.getUriForFile(canonicalUri): vscode.Uri // file: when local, sf-org-data: otherwise
OrgMetadataResolver.readFile(canonicalUri): Uint8Array
OrgMetadataResolver.download(canonicalUri): vscode.Uri
```

`getUriForFile` is the generalization of today's hand-rolled `localUri ?? orgOnlyUri`.

### 3.5 `readFile` is location-agnostic

`provider.readFile(canonicalUri)`:

- **in-workspace** → read directly from `workspaceUri` (read-only convenience).
- **org-only** → fetch source from the org, store an **ephemeral** copy, return it. Never persisted;
  evicted on org change by the existing lifecycle reactor.

Editing still goes through `getUriForFile → file:` (§3.3); this is a read convenience only.

## 4. Architecture

### 4.1 New components: `OrgMetadataCatalog` and `OrgMetadataResolver` (services)

`OrgMetadataCatalog` owns discovery, relationships, presence, and inventory caching:

1. **Compute the union** for `org-metadata/<xmlName>` on demand: fold **`inOrg`** (from
   `MetadataDescribeService.listMetadata(type, folder?)`) with **`inWorkspace` + `workspaceUri`**
   (from `MetadataRetrieveService.buildComponentSetFromSource(packageDirs, [{type, fullName:'*'}])` →
   `getSourceComponents()`, deduped by shortest content path).
2. **Answer** `isInWorkspace`, `getPresence`, `getChildren`, and `getEntry` from the cache.
3. **Represent rich relationships** the filesystem contract cannot express, including
   `CustomObject → CustomField`.
4. **Maintain the catalog cache** in response to presence-change events (§4.4).

`OrgMetadataResolver` owns the VS Code document facade:

1. **Project catalog entries** into `stat` / `readDirectory`.
2. **Resolve org source** on `readFile` of an org-only entry (per-type fetch strategy; ApexClass =
   Tooling `SELECT Body`, generic = single-component retrieve).
3. **Resolve editor targets** with `getUriForFile`.
4. **Materialize** org-only source into the workspace with `download`.
5. **Cache only transient document bytes**, independently of the catalog cache.

Canonical URI construction and parsing live in neutral `orgMetadataUris.ts`; neither service owns identity.

It is registered in `globalLayers` alongside `MetadataDescribeService`.

### 4.2 The provider stays owner-agnostic; behavior is contributed

`OrgDataFsProvider` remains a plain class registered before the Effect runtime exists. It **dispatches
on the `<owner>` path segment** and delegates `org-metadata` behavior to the resolver via the
established `getServicesRuntime().pipe(...)` idiom (same pattern the sibling memfs provider uses). The
provider gains no import of the resolver — the hook is injected at the composition root (`index.ts`),
keeping the provider owner-agnostic and avoiding the circular dependency that a direct import creates.

### 4.3 The `apex-testing` owner collapses into `org-metadata`

An Apex class **is** the `ApexClass` metadata type — canonically keyed at `org-metadata/ApexClass/…`.
A separate `apex-testing/classes/…/Foo.cls` entry would be a second canonical key for the same
component, violating §3.1. So apex-testing stops owning class storage and resolves class source
through the shared `org-metadata/ApexClass/<name>` entries. A retrieve fired from Org Browser instantly
updates apex-testing's view because they **share the entry** — the concrete abstraction win.

apex-testing's **test-discovery tree stays exactly where it is** — in `TestController.items` (the VS
Code test API mandates it). That tree feeds the Test Explorer view only; it is unrelated to the Org
Browser tree and never routes through the VFS.

### 4.4 Event wiring — keeping the cache truthful

Every presence-changing signal is **already services-owned**; the catalog/resolver lifecycle subscribes rather than
anything relocating:

| Event                            | Source (already in services)                 | Cache action                                                                                                       |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Org list/describe                | `MetadataDescribeService`                    | sets `inOrg` (the pull source)                                                                                     |
| Retrieve-to-workspace completes  | `MetadataRetrieveService.retrieve`           | invalidates catalog presence before resolving the post-retrieve URI ("a fetch by one consumer is a fetch for all") |
| Workspace file add/change/delete | `fileWatcherService` → `fileChangePubSub`    | clears catalog/content caches, fires provider `onDidChangeFile`, and publishes `OrgMetadataChangePubSub`           |
| Org change                       | `defaultOrgRef` / `orgDataLifecycle` reactor | clears both caches for the old org                                                                                 |

**Latent bug this fixes:** Org Browser's `filePresent` is stale between manual refreshes today —
`invalidateForNode` reacts only to explicit refresh + org change, never to workspace file events. The
resolver subscribed to `fileChangePubSub` corrects this for every consumer at once.

## 5. Data flow

- **Tree expand (Org Browser):** `OrgMetadataCatalog.getChildren(org-metadata/<type>/)` returns rich
  union entries (cached) → nodes render directly from catalog presence and metadata attributes.
- **Filesystem navigation:** VS Code calls `readDirectory(org-metadata/<type>/)` → resolver projects
  the same catalog entries into `[name, FileType]`.
- **Open a component:** consumer calls `getUriForFile(canonicalUri)` → opens `file:` (in-workspace) or
  `sf-org-data:` (org-only, read-only + Download lens).
- **Open org-only content:** VS Code calls `provider.readFile(sf-org-data:…)` → resolver fetches org
  source → ephemeral cache → bytes returned.
- **Download lens / retrieve:** retrieve-to-workspace completes → catalog invalidates and re-scans → next
  `getUriForFile` returns the `file:` URI; open editors re-read via `onDidChangeFile`.
- **User creates/deletes a file on disk:** `fileChangePubSub` event → catalog invalidates `inWorkspace` →
  tree icon flips with no manual refresh.

## 6. The boundary rule (how logic relocates)

> **Services reads the discovery already present in existing methods' return values. A method never
> grows a VFS-population side effect.**

- `MetadataDescribeService.listMetadata` and `MetadataRetrieveService.buildComponentSetFromSource`
  stay **unchanged**. The catalog **calls them and projects their returns** into inventory entries.
- **Rejected:** mutating `buildComponentSetFromSource` to self-populate the VFS ("silent capture") —
  it couples unrelated callers (retrieve/deploy), makes freshness non-deterministic, and breaks
  owner-agnosticism.

So relocated logic moves as a **new catalog consuming existing methods**, not as a wrapper that
changes them or a side effect scavenged from them.

## 7. Relocation inventory (authoritative — reconciles findings §12.5/§12.7)

### 7.1 Bucket 1 — IN SCOPE (required; leaving these duplicated keeps the discard alive)

**Relocate into the catalog/resolver subsystem:**

- `apex-testing/utils/testUtils.ts:86` `buildClassToUriIndex` → generalized workspace-presence
  computation.
- `apex-testing/utils/orgApexClassProvider.ts` (`lookupClassBody` Tooling `SELECT Body`, `sf-org-apex`
  content provider, `createOrgApexClassUri`) → the `org-metadata/ApexClass` document resolver.
- `apex-testing/views/apexTestTreeService.ts:527-559` `fetchClassBodiesByFullName` → subsumed by lazy
  `readFile`.
- `org-browser/tree/metadataTypeTreeProvider.ts` (`filePresent` via `getComponentFilenamesByNameAndType`),
  `tree/customField.ts` (CustomField presence), `commands/retrieveMetadata.ts` `isMemberPresentInProject`
  → catalog presence.

**Delete (superseded by the shared catalog/resolver):**

- `apex-testing/discoveryVfs/apexTestDiscoveryService.ts` eager `writeOrgData` body loop.
- `apex-testing/index.ts:68-72` + `orgApexClassProvider` `sf-org-apex` provider registration.

**Repoint (call the catalog/resolver instead of computing):**

- `apex-testing/views/orgTestItems.ts:200-202` and `apexTestTreeService.ts:958-960` `localUri ??
orgOnlyClassUri` → `getUriForFile`.
- `apex-testing/views/testController.ts` `retrieveOrgOnlyClass(FromUri)` +
  `retrieve/orgOnlyRetrieveCodeLensProvider.ts` → the retrieve is the presence-flip; open via
  `getUriForFile`; the lens is the generic §3.3 Download lens on the shared entry.
- `org-browser` tree `getChildren` → catalog `getChildren`; open → resolver `getUriForFile`.

**Wire (no relocation — connect already-owned events):**

- Retrieve completion, `fileChangePubSub` subscription, org-change reactor, `invalidateForNode` → cache
  updates (§4.4).

### 7.2 Bucket 2 — FAST-FOLLOWS (same duplication the catalog subsumes, NOT required for orgFs)

The VFS functions correctly if these are left alone; migrate opportunistically to kill duplication.
They are further proof the catalog is genuinely general (independent teams re-deriving the same facts):

- `vscode-lwc/commands/renameLwc.ts`, `createLwc.ts` + `vscode-lightning/commands/renameAura.ts` — one
  shared LWC+Aura project-presence computation → consume `isInWorkspace`/a listing helper.
- `vscode-metadata/shared/diff/diffHelpers.ts` `matchUrisToComponents` — the canonical `{type,fullName}`
  local↔remote correlation → consume the catalog's correlation.
- `vscode-metadata/conflict/conflictDetection.ts` — overlaps deferred source-tracking (§9); defer with
  it.

### 7.3 Verified NOT targets

`org-browser/services/orgBrowserMetadataRetrieveService.ts` retains its plain retrieve-to-disk behavior;
only post-retrieve catalog/resolver invalidation is wired here.
`vscode-metadata` `deployOnSaveService`/`sourceDiff`/`diffComponentSet`/`projectInfo`,
`vscode-apex` (LSP + embedded-SOQL), the debuggers, `vscode-apex-log` (trace flags/logs),
`vscode-core/metadataSupport` (registry hover/docs), `vscode-org`, soql packages,
`vscode-visualforce` creates (already delegate overwrite to services), and all language-server /
support packages.

## 8. Implementation slices

Sized so each is independently landable and testable; ordered by dependency.

1. **Catalog + `org-metadata` owner (read-through structure + presence).** Add the `org-metadata`
   owner; build `OrgMetadataCatalog` with the union computation (`listMetadata` ⊕ workspace scan);
   wire `readDirectory` read-through and the `isInWorkspace`/`getPresence` catalog helpers;
   subscribe to `fileChangePubSub` + org-change. **No consumer changes yet** — testable via direct VFS
   calls. During implementation, `getUriForFile` moved to the resolver because it selects a document target.
2. **`readFile` document resolver.** Location-agnostic `readFile` + ephemeral cache + per-type fetch
   (ApexClass Tooling `SELECT Body`; generic single-component retrieve). Download code lens on org-only
   content.
3. **Org Browser repoint.** Tree discovery → catalog `getChildren`; presence icon → catalog entry state;
   open → resolver `getUriForFile`. Delete org-browser's direct Metadata API and `filePresent` computations.
4. **apex-testing refactor (the symmetric proof).** Delete the eager write + `sf-org-apex` provider;
   repoint open-target/retrieve/code-lens at the shared `org-metadata/ApexClass` entries; remove the
   `apex-testing` owner from the union.

Bucket 2 fast-follows come after slice 4, each its own small WI.

## 9. Out of scope / deferred

- **Sync-state (local/remote/conflict, change counts, source-tracking deltas)** — separate follow-up;
  the metadata conflict-detection consumer defers with it.
- **"What opening means per metadata type"** (the type-sharded UI-gesture logic) — its own discussion.
  The provider-level `readFile` behavior (§3.5) IS in scope; the UI command semantics are not.
- **Durable persistence across reloads** — the provider stays in-memory; the catalog cache is
  per-session and re-listed on reload. Upgrading to durable (IndexedDB) backing is a later WI.
- **The `metadata-preview` owner (stories 2/3)** — remains a separate content-bearing owner; the
  generic `readFile` resolver is where per-type fetch plugs in, but folding preview in is not this WI.

## 10. Testing strategy

- **Catalog/resolver unit tests (services):** union computation given fixture `listMetadata` +
  `buildComponentSetFromSource` returns; `getUriForFile`/`isInWorkspace` truth table across the four
  `{inOrg, inWorkspace}` combinations; cache invalidation on each §4.4 event (esp. the
  `fileChangePubSub` file-add/delete path — the fix for the stale-`filePresent` bug).
- **Provider tests:** `readDirectory` read-through returns the union; `readFile` org-only fetches +
  caches ephemerally + does not persist; read-only writes throw `NoPermissions`.
- **Org Browser Playwright specs:** tree populated via the catalog; `filePresent` icon reflects
  workspace state and updates on file create/delete without manual refresh (new coverage for the bug).
- **apex-testing:** open an org-only test class → read-only + Download lens; download → next open is the
  `file:` URI; test-discovery tree in Test Explorer unchanged.

## 11. Planning outcomes

1. **Cache granularity/invalidation:** per-org/per-type catalog entries; workspace and org changes
   invalidate the session cache. This is intentionally coarse until profiling justifies path inversion.
2. **`readFile` ephemeral hold-duration:** resolver content is held for the session and cleared on
   workspace/org lifecycle events or explicit resolver invalidation.
3. **Path/namespace conventions:** canonical paths retain metadata `fullName`; namespace and
   manageable-state remain catalog attributes. Managed protected Apex remains a read-only edge case.
4. **Async `readDirectory`/`stat`:** owner handlers return `Thenable` and no synchronous consumer
   assumption remains.
5. **WI decomposition:** slices 1–4 landed together under W-23613533 after story 0.
6. **Filesystem versus catalog boundary:** filesystem methods expose document-shaped structure and
   bytes; relationships and rich metadata are catalog APIs. The catalog is not a second store—it is
   the single inventory backing the resolver's filesystem projection.
