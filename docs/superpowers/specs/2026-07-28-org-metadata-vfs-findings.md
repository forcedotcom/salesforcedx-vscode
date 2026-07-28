# Org Metadata VFS — Findings & Working Notes

**Status:** DRAFT / in-discussion (not yet an approved design)
**Date:** 2026-07-28
**Author:** Peter Hale (with Claude)
**Related work items:** W-23237608 (Closed — absorbed), W-23596477 (story 0), W-23237612 (story 2), W-23237610 (story 3)
**Epic:** IDEx - Org Browser: Actions (`a3QEE000002V05p2AC`)
**Base branch for stacking:** `ph/W-23596477-org-data-vfs-services`

> This document captures what we have learned and decided **so far** during brainstorming.
> It is deliberately a findings log, not a finished spec. Open questions are tracked at the end.

---

## 1. Origin of this investigation

The user asked to start W-23237608, stacked on the current branch. Investigation found:

- **W-23237608 is Closed.** Its own description states the scope was *not* descoped/deferred but
  **redistributed** into story 0 (W-23596477) and story 3 (W-23237610). There is nothing left to
  build under that ticket as written.
- The user identified a **real gap not covered by any existing story**: *nothing populates the
  org-data VFS with the org's metadata* so the Org Browser has a VFS-backed data source. Stories
  0/2/3 provide the pipe (VFS), a single-item content extractor, and a single-item preview consumer
  — but no producer of the **tree** itself.

## 2. What exists today (verified by code exploration)

### 2.1 The `sf-org-data` VFS (built under story 0, W-23596477)

- Scheme constant `ORG_DATA_SCHEME = 'sf-org-data'` — `salesforcedx-vscode-services/src/orgVfs/orgDataUris.ts:11`.
- Provider `OrgDataFsProvider implements vscode.FileSystemProvider` —
  `salesforcedx-vscode-services/src/orgVfs/orgDataFsProvider.ts:56`.
  - Registered once at `src/index.ts:328-334` with `{ isCaseSensitive: true, isReadonly: true }`.
  - **Editor-read-only, service-writable:** public `writeFile`/`delete`/`createDirectory`/`rename`
    all throw `NoPermissions`; privileged `writeFileInternal`/`createDirectoryInternal`/
    `deleteInternal` (lines 109–137) are reachable *only* via `FsService`.
  - **Backing store is a purely in-memory tree** (`private readonly root = createDirectoryEntry()`,
    `orgDataFsProvider.ts:57`). Not memfs, not IndexedDB, not disk. Dies with the extension host.
    (Contrast: the sibling `virtualFsProvider/` memfs provider IS IndexedDB-backed.)
- URI layout: `sf-org-data:/orgs/<orgKey>/<owner>/<...segments>` where **`orgKey` == org id**.
  Builders in `orgDataUris.ts` (`orgRoot`, `orgDataOwnerRoot`, `orgDataUri`, `orgDataSegments`,
  `orgDataOwner`, `orgDataDocumentSelector`).
- **Owners** (well-known top-level folders): `type OrgDataOwner = 'apex-testing' | 'metadata-preview'`
  (`orgDataUris.ts:14`). Adding a new data category = adding an owner.
- `FsService` org-data API (`salesforcedx-vscode-services/src/vscode/fsService.ts`):
  `writeOrgData` (:243), `createOrgDataDir` (:247), `deleteOrgData` (:249), `clearOrgData` (:251),
  and `findFiles` (:196) which handles the `sf-org-data` scheme via recursive `walkFiles`.
  **There is no `readOrgData`** — reads go through the standard read-only provider
  (`vscode.workspace.fs.readFile` / opening `sf-org-data:` URIs in editors).
- Central lifecycle reactor `orgDataLifecycle.ts`: on org change, closes stale tabs then purges
  foreign-org directories (`reconcileOrgDataLifecycle` :24, `watchOrgDataLifecycle` :47, wired at
  `index.ts:286`).
- Decoration provider paints the `ORG` badge on any `sf-org-data` URI
  (`orgDataDecorationProvider.ts:13`, registered `index.ts:335`).
- Context key `sf:orgDataOwner` from the active editor's owner (`editorContext.ts`).
- **API export surface:** the URI builders + `FsService` are exposed on the `services` sub-object
  (`index.ts:145-150`, `:415-420`). `ORG_DATA_SCHEME` itself is NOT exported (internal); consumers
  get URIs via the builder functions.
- **Populators today:** only `apex-testing` (writes discovered class bodies under owner
  `apex-testing` via `apexTestDiscoveryService.saveDiscoveredClasses`). The `metadata-preview`
  owner is declared but has no populator yet (reserved for stories 2/3).

### 2.2 The Org Browser extension (`salesforcedx-vscode-org-browser`)

- Reads metadata **live** from the org: `MetadataDescribeService.describe()` /
  `listMetadata(xmlName[, folder])` → `conn.metadata.describe()` / `conn.metadata.list()`
  (`salesforcedx-vscode-services/src/core/metadataDescribeService.ts`).
- **Does NOT touch `sf-org-data` at all** (verified: no references in its `src`).
- **Caches only in-memory in services**, via Effect `Cache` in `MetadataDescribeService`, keyed
  **per-org (`orgId`)**: `describeCache` (30 min), `listMetadataCache` (500 cap, **5 min**), plus
  sobject caches. Switching orgs isolates data.
- Tree model: `src/tree/orgBrowserNode.ts` — kinds `type` / `folderType` / `folder` / `component` /
  `customObject`; `contextValue = inputs.kind` (bare kind string). Icon from `filePresent`
  (`pass-filled` vs `circle-large-outline`).
- Tree provider: `src/tree/metadataTypeTreeProvider.ts` — `getChildrenOfTreeItem` (:247-345) drives
  expansion; `listMetadataToComponent` (:347) and `listMetadataToFolderItem` (:376) build nodes.
- **`filePresent`** computed per node via
  `ComponentSet.getComponentFilenamesByNameAndType({ fullName, type })` (project ComponentSet from
  `ComponentSetService.getComponentSetFromProjectDirectories()`).
- Consumes services heavily via `api.services.*` (extensionDependency on
  `salesforce.salesforcedx-vscode-services`).
- Retrieve-to-disk is the only disk write, and only on the explicit `retrieveMetadata` command
  (writes into the project default package via SDR merge).
- Existing Playwright specs under `test/playwright/specs/` (customObject, customTab, describe,
  folderedReport, filterToggle, textFilter); POM at `test/playwright/pages/orgBrowserPage.ts`.

### 2.3 The prior experiment (`phale/org-browser-experiment`)

This branch is the ground truth the user pointed to. Key finding: **its VFS stored only previewed
file bodies**, not the tree.

- `src/services/assetPreviewFs.ts` — `AssetPreviewFs`, scheme `sf-metadata-preview`, in-memory
  `Map<path, {data,ctime,mtime}>`, editor-read-only + privileged `writeFileInternal`, `clear()` on
  org change. **This is the direct predecessor of story 0's `metadata-preview` owner** — story 0
  moved this exact concept into the services-owned `sf-org-data` scheme.
- Written into it: **single component file bodies, on click**, by two commands:
  - `previewOrgComponent` — `retrieveMemberContent(members)` → pick main zip entry → `writeFileInternal(sf-metadata-preview:/<xmlName>/<componentName>/<fileName>)` → `vscode.open`.
    **== stories 2 + 3.**
  - `openLocalComponent` (ContentAsset branch) — reads local asset + `-meta.xml`, writes body under
    its `pathOnClient` name, opens it.
- **Everything else the org browser needed was NOT in the VFS:**
  | Data | Where it lived in the experiment | In VFS? |
  |------|----------------------------------|---------|
  | Org metadata representation (types/folders/components) | `MetadataDescribeService` per-org in-memory cache (already in **services**) | No |
  | Local file presence (`filePresent` icon) | Computed per-node via `getComponentFilenamesByNameAndType` | No |
  | Sync state (local/remote/conflict, change counts, state filters) | `SourceTrackingCacheService` — in-memory `Map` in the **extension** | No |
  | Filter/toggle state (showLocal/showOrg, text filter) | Fields on `MetadataTypeTreeProvider` (UI state) | No |
  | Previewed file bodies (single component, on click) | `AssetPreviewFs` (`sf-metadata-preview`) | **Yes — only this** |

  Conclusion: the experiment never populated the VFS with a metadata **tree**; it stored preview
  content one component at a time. Stories 2+3 already reproduce that.

## 3. What the user actually wants (clarified during discussion)

The user's framing (their words, distilled):

- The Org Browser displays a **tree of what exists in the org and in the local file system**, with
  icons for local presence and filters (local-only / org-only toggles + text filter). The
  **org-representation + local-presence** data should move to be **owned by services**, not scattered
  in extension-side maps. There may be overlap with the existing per-org `MetadataDescribeService`
  cache (there is — see 2.2).
- **"VFS becomes the tree"** and **"custom TreeView backed by VFS"** were chosen: keep the custom
  `sfdxOrgBrowser` TreeView (its filters/toggles/actions), but its `getChildren` reads from VFS
  `readDirectory` instead of calling `conn.metadata.list` directly.
- The deeper intent (decisive reframing): **the VFS is a uniform, scheme-based *consumption
  surface*, exposed from services, so any extension can consume a variety of data the same way
  ("open text document using a URI", `readDirectory`, `findFiles`) instead of bespoke code per data
  type.** Services already exposes rich metadata **APIs**; the VFS is the URI-addressable *delivery
  layer* on top of them.
- **Data ownership per owner-folder:** the *plumbing* (scheme, provider, lifecycle, URI builders,
  read/write API) is owned by **services**; the **data within an owner folder is contributed by
  whichever extension owns it** (apex-testing owns `apex-testing`; org-browser would own a new
  `org-metadata` owner and the `metadata-preview` owner).
- **Sync-state (SourceTrackingCacheService): explicitly DEFERRED** to a separate follow-up.

## 4. Emerging shape (tentative — NOT yet approved)

Leading direction ("Approach A" from discussion):

- Add a new services-owned **owner** (working name `org-metadata`) to the `OrgDataOwner` union.
- **Org-browser is the data-owner/contributor**: on activation / org change, it walks
  `conn.metadata.list`/`describe` (reusing the existing per-org describe-cache as the source) and
  **populates the VFS** with the hierarchy as **directories for types/folders + marker entries for
  components**:
  ```
  sf-org-data:/orgs/<orgId>/org-metadata/<xmlName>/<component>
  sf-org-data:/orgs/<orgId>/org-metadata/<folderType>/<folder>/<component>
  ```
- The custom TreeView's `getChildren` **reads back via `readDirectory`** (the round-trip that proves
  the thesis end-to-end).
- **Content stays lazy** via the existing preview mechanism (stories 2/3): navigating to a marker
  and opening it = retrieve-on-demand → write content → open. This is how "unify tree + preview"
  happens *without* eagerly retrieving a whole org.
- **Presence / filters stay as extension-side decoration** (presence via
  `getComponentFilenamesByNameAndType`; filters are UI state). VFS carries **structure**; the
  extension paints the rest. **Sync-state deferred.**

Why a VFS and not just the existing service cache — four drivers the user affirmed ("all of the
above"):
1. **Persistence across reloads** (needs durable backing — see open questions).
2. **Unify tree + preview content** (achieved lazily, above).
3. **Consolidate ownership in services.**
4. **Cross-extension shared access** via a uniform URI space.

The uniform-consumption-surface framing (§3) is what makes #3/#4 the primary justification: it is
not about replacing the cache as a *source of truth*, but about giving all extensions **one
scheme-based way to navigate/open/find** org-derived data.

## 5. Design tensions identified

- **`readDirectory` carries only names + file/dir type.** Per-node data a filesystem can't express
  (kind, `previewable`, presence, sync-state) must be resolved by the consumer at render time
  (cheap: derivable from xmlName + registry + project ComponentSet) or via a sidecar. This is the
  axis the candidate approaches differed on.
- **Tree vs content have different volatility & cost.** Listing is cheap and changes often;
  retrieving content is expensive and changes rarely. Even within one owner they likely want
  **different lifecycles**: persist cheap structure; treat content as a lazily-filled, freely-
  evictable layer.
- **Story 0's provider is in-memory.** True persistence (driver #1) requires upgrading it to a
  durable backing (the IndexedDB mechanism the sibling memfs provider already uses) — a change to
  freshly-landed story-0 code — OR deferring persistence to a later WI.

## 6. Sequencing / work-item impact

- New work depends on **story 0** (scheme/provider/lifecycle) → **stacks on the current branch**.
- It is **complementary to** stories 2 & 3 (preview owner), not a swallower of them — provided
  content stays lazy via that existing mechanism.
- Open: whether this is a **new WI** or a **reopen/repurpose of the closed W-23237608**.

## 7. Open questions (to resolve before writing the final design)

1. **Persistence in scope?** Defer (populate in-memory per session, re-list on reload) vs. include
   (upgrade the `org-metadata` owner to durable IndexedDB backing now). *Working lean: defer.*
2. **Populate-only vs. round-trip?** Producer only, vs. producer + rewire TreeView `getChildren` to
   read `readDirectory`. *Working lean: do the round-trip (populating without consuming is
   untestable dead weight).*
3. **New WI vs. repurpose W-23237608?** (Closed; describes itself as absorbed.)
4. **Marker-file idiom acceptance** — zero-byte component markers + derive `kind`/`previewable`
   from xmlName/registry; confirm this is acceptable vs. a sidecar metadata channel.
5. **Overlap with `MetadataDescribeService` cache** — is the VFS *backed by* that cache (single
   source, VFS as a view) or a *parallel* store kept in sync? Needs an explicit answer.
6. **User has further concerns** — discussion paused here to capture findings; more to come.

---

## 8. Refined model (supersedes §4–5 where they conflict)

Continued discussion sharpened the model substantially. Where the tentative §4/§5 shape conflicts
with the statements below, **§8 wins**.

### 8.1 Ownership: services owns the data; org-browser is a pure consumer

- Services owns **the data the org browser needs**, not just the plumbing. Org-browser interacts
  with it **only via the VFS** — it no longer calls `conn.metadata.list` itself.
- **Population moves *inside* the provider (read-through).** On activation / view-open, org-browser
  does `readDirectory(sf-org-data:/orgs/<orgId>/org-metadata/)`. The provider, on a miss, calls the
  metadata list/describe API (services already owns the connection + `MetadataDescribeService`),
  writes the results into the VFS, and returns them. `readDirectory` is the trigger; the metadata
  API call is the miss-handler; the write is the cache-fill. The same recursion applies down the
  levels (`.../org-metadata/<xmlName>/` → `listMetadata(xmlName)` → components; foldered types add a
  middle level).
- This resolves open question §7.5: the VFS is **the filesystem face over the existing per-org
  `MetadataDescribeService` cache**, not a parallel store kept in sync.

### 8.2 The VFS records PRESENCE, not CONTENT

- **Desired behavior: the org-metadata owner does not retain content. It records presence:
  in-org and in-workspace** — two independent booleans on the same component — and **possibly
  stores pointers** (the coordinates/recipe to resolve the real source).
- An entry is therefore a **stateful presence/pointer index**, i.e. a *resolution recipe*:
  - workspace-present → pointer resolves to the on-disk `file:` source (editable, normal open);
  - org-only → pointer holds the retrieve coordinates (type + fullName [+ folder]); source is
    fetched on demand and the **code lens** offering "pull into workspace" is shown.
- `filePresent` (today computed extension-side via `getComponentFilenamesByNameAndType`) becomes a
  **property of the VFS entry maintained by services**, delivering "services owns the data."

### 8.3 The abstraction goal: hide "where does the source come from"

- Target abstraction (user's words): a consumer says "open this component" and gets source; the
  orgFs makes **org-vs-workspace invisible**. The only user-visible difference between an org-only
  and a workspace component is the code lens on org source. **apex-testing already does exactly this
  by hand for test classes — the goal is to make the orgFs provide it generically** so no consumer
  reimplements presence/fetch/open.

### 8.4 Two population directions

- **Pull:** `readDirectory` miss → list API → entries with **org-presence = true**.
- **Push:** a retrieve-to-workspace side effect fired **anywhere in services, by any consumer**
  (retrieval operations are services-owned: `MetadataRetrieveService.retrieve` /
  `retrieveMemberContent`) flips the matching entry's **workspace-presence = true**. **No content is
  copied** — the real file lives on disk under `file:`; the VFS records only *that it now exists
  locally*. "A fetch by one consumer is a fetch for all" — but recorded as presence/pointer, not
  stored bytes.

### 8.5 The provider SHARDS behavior by owner

- The orgFs is **not** one uniform filesystem. It is a **dispatch layer keyed on the `<owner>`
  segment** of the path. `fs.readDir` for the org-browser metadata owner yields different actions
  than `fs.readDir` for the apex-testing owner. **Behaviors shard by owner.**
- Each owner is a strategy responsible for **what its subfolder means, how it is populated, and what
  shape is stored**:
  - **`org-metadata` owner** — `readDirectory` → metadata list/describe; entries are the
    presence/pointer index over standard metadata; shape = type/folder/component hierarchy.
  - **`apex-testing` owner** — `readDirectory` → a **different API** (Apex test-listing, not
    `conn.metadata.list`); stored shape is **test results, not metadata**. The owner defines the
    shape — this is the extra complexity the orgFs impl must accommodate.
- Implies a **per-owner handler registration** mechanism: services owns the plumbing + dispatch;
  each owner registers its handler (its `readDirectory` behavior, population source, shape).

### 8.6 Two categories of owner behavior

- **Category 1 — the "simple" filesystem.** Passive store: something writes entries;
  `readDirectory`/`readFile` return what's there. **This is what story 0 already built.**
  apex-testing's *storage of its non-metadata Apex-test info* is Category 1, and it "can probably
  satisfy many other owners" — it is the reusable base, not apex-testing-specific.
- **Category 2 — the org-metadata presence/pointer index + source resolver.** Stateful: records
  presence, holds pointers, and resolves "open this component's source" (workspace `file:` vs org
  fetch + code lens). This is the new behavior.
- **Open-resolution should defer to Category 2, not be reimplemented.** apex-testing's current
  "click test method → is the class in workspace or org? → fetch → open + code lens" logic is
  likely **comingled** with its Category 1 test-info storage. That comingled resolution code should
  be **extracted to defer to the metadata store**. So Category 2 is a **shared source-resolution
  facility** any consumer uses; apex-testing's test-info *storage* stays Category 1.

### 8.7 apex-testing is IN SCOPE as the proof

- apex-testing is refactored **as part of this work** to defer to the orgFs resolver, **including
  triggering fetches the same way org-browser does** when populating. A second independent consumer
  on the same facility is what proves the abstraction is generic rather than an org-browser-shaped
  API in filesystem clothing.
- **WI success criterion (symmetric):** org-browser populates its tree and opens components through
  the orgFs; apex-testing resolves and opens test source through the **same** orgFs — with **no
  consumer-specific fetch/presence/open code left in either**.
- apex-testing's Category 1 test-info storage stays as-is; only its *resolution/open* path defers to
  Category 2.

### 8.8 The narrow `readFile` case IS in scope (distinct from the deferred UI "open")

- **Deferred (own later discussion):** the type-sharded, UI-gesture-level "what should clicking a
  node *do*" logic (from the experiment) — *what it means to open metadata type X.*
- **In scope now:** the provider-level `readFile`. When VS Code itself calls `provider.readFile(uri)`
  because an editor shows a VFS URI whose state points at the org, the provider must, for an
  org-pointing **Apex class** (the proof instance): follow the pointer → **fetch source on demand** →
  return bytes → **retain nothing persisted**. So `readFile` for an org-pointing entry is an **active
  resolver**, and the org-pointing URI **is itself the openable document** (resolution model "A",
  scoped to `readFile` + org-pointing only).
- **Consequences to design for:** `readFile` becomes async / may hit the network (story 0's is a
  synchronous in-memory return); and "no retain" needs a defined caching *lifetime* — see §7 item
  added below. **The current apex-testing code path is the model** for exactly this behavior; a
  dedicated exploration is tracing it (open question §7.7).

### 8.9 Updated open questions

7. **`readFile` caching lifetime for org-pointing entries.** Purest no-retain = re-fetch on every
   `readFile`. Likely intent = fetch-once-while-open (hold bytes for the open editor's lifetime /
   until org change), nothing *persisted*. **To be answered from the apex-testing model.**
8. **Owner-handler registration contract** — is generalizing story 0's provider into an
   owner-sharded dispatcher part of this WI, or a separate foundational WI with this WI building
   only the `org-metadata` handler? (Working lean given §8.7: the dispatcher + `org-metadata`
   handler + apex-testing deferral are all this WI, since apex-testing is the proof.)
9. **Scope size / decomposition** — §8.5–8.7 make this materially larger than the §4 sketch
   (dispatcher + presence/pointer index + async resolving `readFile` + apex-testing refactor). May
   need to decompose into sub-WIs while keeping the two-consumer proof intact.

### 8.10 Superseded earlier leans

- §4 "org-browser is the producer that writes into the VFS" → **superseded**: population is
  read-through *inside the provider*; org-browser is a pure consumer (§8.1).
- §4 "content stays lazy via stories 2/3's preview owner; VFS carries structure" → **refined**: the
  org-metadata owner carries **presence/pointers, not content**; content is resolved at `readFile`
  and not retained (§8.2, §8.8). Preview owner (stories 2/3) remains a *separate content-bearing
  owner* — a Category 1-ish store — distinct from the org-metadata presence index.
- §5 "presence via extension-side `getComponentFilenamesByNameAndType`" → **superseded**: presence
  is a VFS-entry property maintained by services (§8.2).

---

## 9. SETTLED model (accepted by user — supersedes §8 where they conflict)

A bottom-up pass over the actual `vscode.FileSystemProvider` contract
(`@types/vscode/index.d.ts:8880-9040`) plus the live apex-testing trace reconciled the remaining
tensions. **This section is the accepted definition of the VFS. Where §8 conflicts, §9 wins.**

### 9.1 The FileSystemProvider contract → gesture → orgFs mapping (grounding)

Provider surface is 10 members; **every accessor may return `Thenable`** — so async / network-backed
`stat`/`readDirectory`/`readFile` are fully within the API (only a departure from story 0's
*synchronous in-memory implementation*, not from the contract).

- `readDirectory(uri) → [name, FileType][]` — from `fs.readDirectory` / TreeView `getChildren`; the
  read-through populate trigger.
- `stat(uri) → FileStat` — called before almost everything (open, hover, breadcrumb). `FileStat`
  carries `type` (bitmask, may include `SymbolicLink`), `mtime`, `size`, `permissions?: Readonly`.
- `readFile(uri) → Uint8Array` — from `vscode.open`/`openTextDocument` and every reload/revert.
- `writeFile`/`createDirectory`/`delete`/`rename` — public forms throw `NoPermissions` (provider is
  registered `isReadonly: true`); privileged `*Internal` methods do population/purge.
- `watch` + `onDidChangeFile` — fire `Changed`/`Created`/`Deleted` so open editors + tree re-read;
  `mtime` must advance and `size` be correct or VS Code shows stale bytes.
- `copy?` — optional, omitted.

### 9.2 Rejected: writable overlay proxying all workspace files

A design was explored where the VFS became **writable as a whole**, presenting one canonical
`sf-org-data:` URI per component and proxying `stat`/`read`/`write` to the real `file:` resource for
in-workspace entries, using `stat.permissions` to gate write access. **REJECTED as too invasive.**
Reason: workspace-aware background activities (language-server file scanners, search indexing,
source tracking) would traverse a synthetic scheme instead of `file:`, a blast radius far larger
than the feature. The fully-fledged VFS-over-all-workspace-artifacts is explicitly out of scope.

### 9.3 The VFS stays READ-ONLY; editing always goes through `file:`

- `sf-org-data` remains **read-only** (as story 0 built it). Edits **never** route through the
  provider. Org-only content is the only thing ever *opened from* the scheme — read-only, with the
  "Download" code lens to promote it to the workspace.
- In-workspace editing happens on the **`file:` URI** obtained via a helper (§9.5), so LSPs,
  scanners, and source tracking see normal `file:` paths, untouched.

### 9.4 The VFS path is the CANONICAL KEY; each entry holds combined state

- Every component that exists in org and/or workspace has **one canonical `sf-org-data` path**
  (e.g. `sf-org-data:/orgs/<orgId>/<owner>/ApexClass/Foo.cls`). The VFS is populated with the
  **UNION** of org + workspace entries — not org-only — so presence helpers can answer for any
  component.
- The VFS is a **guide/helper for presence**, NOT the surface through which all file ops route.
- Each entry carries a combination of **state**:
  ```
  {
    inOrg: boolean,
    inWorkspace: boolean,
    workspaceUri?: Uri,          // present when inWorkspace — where the real file lives
    ephemeralContent?: Uint8Array // present only transiently when a VIEW needed org content
  }
  ```
- **Population of state:** pull (org list/describe) sets `inOrg`; workspace scan + retrieve
  side-effects set `inWorkspace` + `workspaceUri`.

### 9.5 Helper APIs express state OUTSIDE the FS method set

The FS methods alone can't express this state cleanly, so services exposes helper APIs alongside
them (illustrative signatures):

- `OrgFs.isInWorkspace(vfsUri) → boolean` (and/or `getPresence(vfsUri) → {inOrg, inWorkspace}`).
- `OrgFs.getUriForFile(vfsUri, options) → Uri` — resolves the URI a consumer should **open**:
  the **`file:` URI when in-workspace**, the **`sf-org-data:` URI when org-only**.

This makes the presence question (previously "how does one filesystem encode two bits?") moot at the
FS layer: presence is answered by helpers, not by overloading `FileType`/symlink semantics. (Note:
`SymbolicLink` was considered but the provider contract has no `readlink`/link-target method, so a
cross-scheme `sf-org-data:`→`file:` symlink almost certainly would not auto-resolve — it would only
be a marker. Helpers are the honest mechanism.)

### 9.6 Standard `readFile` follows the predetermined path (location-agnostic content access)

`readFile(vfsUri)` is a **location-agnostic content accessor** — the uniform-consumption thesis:

- **in-org** → fetch content from the org, **store an ephemeral copy in the VFS**, return the org
  content.
- **in-workspace** → read content **directly from the workspace location** (`workspaceUri`).

Editing still uses `getUriForFile → file:` (§9.3/9.5); `readFile` resolving to workspace content is a
**read-only convenience**, and the provider stays read-only.

### 9.7 What §9 settles from the open questions

- §8.2 "records presence, NOT content" → **refined**: the entry records **state** (presence +
  workspaceUri) *and* may hold **ephemeral content transiently** when a view needs org bytes (§9.4,
  §9.6). "Does orgFs store content?" → only as the materialization of an explicit view; the default
  state is presence-only.
- §8.9-7 "`readFile` caching lifetime" → ephemeral copy stored on view; not persisted; evicted on
  org change (existing lifecycle reactor). Exact hold-duration (per-open-editor vs until org change)
  still to pin during planning, but "ephemeral, not persisted" is settled.
- Philosophy 2 (consumer carries `file:` for in-workspace) is **superseded by §9.4's union model**:
  the VFS DOES hold in-workspace entries (as state + `workspaceUri`), so it can answer presence
  helpers; but VS Code still *edits* via the `file:` URI those helpers return. Best of both: single
  canonical key for presence, real `file:` for workspace operations.

### 9.8 Still parked (unchanged)

- **What "open" means per metadata type** — the type-sharded UI-gesture logic from the experiment.
  Its own later discussion; NOT this planning pass. (The narrow provider-level `readFile` behavior in
  §9.6 IS settled; the UI-command-level "what should clicking type X do" is not.)

---

## 10. The structure/content fork — RESOLVED (supersedes §9.1's populate assumption)

Tracing apex-testing's live storage surfaced an apparent contradiction with "VFS becomes the tree":
apex-testing keeps its discovered test tree in an **in-memory model** (`vscode.TestController.items`
+ five `Ref<Map>` indices in `apexTestTreeService.ts:210-216`) while writing **.cls bodies** into the
VFS (`apexTestDiscoveryService.saveDiscoveredClasses`). The fork: does org-metadata *structure* live
in the VFS (`readDirectory`) or in a services model, with the VFS holding only content/presence?

**Resolution (user's ruling):** the contradiction dissolves into **two distinct data models with
opposite verdicts** — they were conflated.

### 10.1 Model 1 — test-discovery results → in-memory model. CORRECT, unchanged.

- The discovered class/method **tree** that populates the **Test Explorer view** belongs in
  `TestController.items` + the `Ref<Map>` indices. This is **test-platform structure the VS Code test
  API mandates**, not org-metadata the VFS should own. It stays exactly where it is.
- **Two different views, two different trees, no relationship:** the Test Explorer tree
  (← `TestController.items`, in-memory) and the Org Browser tree (← orgFs VFS `readDirectory`,
  filesystem-shaped) are entirely separate. apex-testing does **not** feed the Org Browser tree and
  never will; its discovered test tree is a private concern of the Test Explorer. **apex-testing's
  only touchpoint with orgFs is content/presence for its classes (§10.2/§10.3) — never structure.**
- This is **NOT** the org-browser use case and is **not** evidence for "structure in a model"
  generally — apex-testing was never free to put a `TestItem` (run-state, method source positions,
  pass/fail, suite membership) into a flat `readDirectory` result. The org-browser tree, by contrast,
  IS filesystem-shaped (type=dir, component=file, foldered types=nested dirs), so the test-tree
  precedent does not transfer. **"VFS becomes the tree" stands for org-metadata navigation.**

### 10.2 Model 2 — eager `.cls` body write into orgFs. WRONG. This IS the org-browser case.

- `saveDiscoveredClasses` today does `clearOrgData` → recreate dirs → per-class
  `writeOrgData(classUri, body)` — **eagerly pre-materializing content nobody has asked to view.**
  This is precisely the org-browser open-a-component case in disguise, and it must follow the §9.6
  `readFile` model instead:
  - The VFS records **presence** (this class exists in the org).
  - The org body is fetched **lazily on `readFile`**: VS Code calls `readFile(orgUri)` → the owner
    resolver runs the source fetch (SOQL `SELECT Body` for apex-testing) → ephemeral content cached
    (§9.6) → returned. **No eager bulk write.**
- **Consequence for the proof:** `saveDiscoveredClasses`'s eager body-writing loop is **deleted**.
  What replaces it is **presence registration** (org-discovered classes → VFS entries with
  `inOrg: true`); content only ever enters the VFS as ephemeral cache during a `readFile`.

### 10.3 "Which URI do I open?" → `OrgFs.getUriForFile()`. Migrates INTO the VFS.

- apex-testing's current open-target decision (`localUri ?? orgOnlyClassUri`,
  `orgTestItems.ts:201-207`, backed by the workspace index `buildClassToUriIndex` in
  `testUtils.ts:86-135`) is **exactly the presence logic that belongs in the §9.5 helper.**
- apex-testing stops computing it and calls `OrgFs.getUriForFile(canonicalUri)` → gets `file:` when
  in-workspace, `sf-org-data:` when org-only → opens whatever comes back. The CodeLens-triggered
  retrieve flips presence, and the next `getUriForFile` returns the workspace URI.
- So `buildClassToUriIndex` (the class→workspace-URI resolver) **migrates into the VFS** as the
  workspace-presence resolver; fetch-on-read + URI-resolution become **shared services behavior**,
  not apex-testing code.

### 10.4 Net effect on apex-testing (the proof)

- **Stays:** test-discovery results in `TestController.items` + `Ref<Map>` indices (Model 1).
- **Deleted:** eager `.cls` body write loop in `saveDiscoveredClasses` (Model 2) → replaced by
  presence registration.
- **Migrates to services:** `buildClassToUriIndex` presence/URI resolution → `getUriForFile`;
  fetch-on-read → provider `readFile` resolver.
- `apexTestingClassUri`/`apexTestDiscoveryService` shrink to a **presence contribution** for the
  `apex-testing` owner. This is the concrete, testable form of the §8.7 symmetric success criterion.

### 10.6 The `apex-testing` owner COLLAPSES into `org-metadata`

Once §10.2 deletes the eager `.cls` body write, the `apex-testing` owner would hold only
**presence + source-resolution for Apex classes** — but an Apex class *is* the `ApexClass` metadata
type, canonically keyed at `org-metadata/ApexClass/<fullName>` (§9.4). An
`apex-testing/classes/…/Foo.cls` entry is therefore a **second canonical key for the same
component**, violating "one canonical path per component." So the `apex-testing` owner is
**eliminated**, folding into `org-metadata`:

- apex-testing discovers its test tree (Tooling `tests` API) into its in-memory `TestController`
  (Model 1, unchanged — never was VFS).
- apex-testing resolves/opens class **source** through the *same* `org-metadata/ApexClass/<name>`
  entries org-browser uses (§9.5 helpers / §9.6 `readFile`). A retrieve fired from org-browser
  instantly updates apex-testing's presence view because they **share the entry** — the concrete
  abstraction win.

**Sequencing:** the `org-metadata` owner (this slice) is what *absorbs* apex-testing; it is built
first. `'apex-testing'` stays in the `OrgDataOwner` union until the **apex-testing-refactor slice**
(delete `apexTestDiscoveryService`'s eager write → repoint source resolution at `org-metadata`),
because story-0's shipped code still writes to that owner. Removing the owner in this slice would
break shipped apex-testing.

**Parked reconciliation** (already §9.8, restated for this collapse): path/namespace conventions
(`classes/<ns>/<Outer>/<Inner>.cls` dotted-split vs flat `fullName` + `namespacePrefix`), and
managed-package test classes that appear in the Tooling `tests` API but not in
`metadata.list('ApexClass')` (a presence-display edge, not a source-resolution gap — their source is
not retrievable anyway).

### 10.7 `buildClassToUriIndex` is a DISCARDED presence discovery → it must feed orgFs

apex-testing's `buildClassToUriIndex` (`testUtils.ts:86`) builds a `Map<className, file:URI>` by
`MetadataRetrieveService.buildComponentSetFromSource(packageDirs, [{type:'ApexClass', fullName:'*'}])`
→ walking source components. **This is a workspace-metadata discovery** — *which ApexClasses exist
locally and where* — i.e. exactly `{ inWorkspace: true, workspaceUri }` for the `ApexClass` entries
that §9.4 says the VFS owns. It is **computed per tree-build, used once for
`localUri ?? orgOnlyClassUri`, and discarded.**

The same fact is discovered a *second* way by org-browser: `getComponentFilenamesByNameAndType`
(`metadataTypeTreeProvider.ts:351`) → the `filePresent` icon. Two consumers, two mechanisms, both
thrown away. **This is precisely the duplication orgFs eliminates.**

Consequences for the design:

- `buildClassToUriIndex` **is** a class-scoped, discarded `getUriForFile` index; `localUri ??
  orgOnlyClassUri` **is** `getUriForFile(canonicalUri)` computed by hand (§9.5).
- Therefore the presence / `getUriForFile` piece is **NOT cleanly deferrable** — deferring it keeps
  the discard alive. The workspace discovery must be **computed and owned by services** (relocated
  out of apex-testing) so `inWorkspace`/`workspaceUri` is computed once and shared. **"Populate
  orgFs" here means the services-side resolution cache, NOT the provider's in-memory tree** — see
  §11 for the two-stores distinction that removes the apparent push-vs-cache contradiction in the
  next bullet.
- Relocated, it also becomes the **workspace half of the `org-metadata/<type>` components
  read-through union** (§9.4): the components-level `readDirectory` folds org list (`inOrg`) with a
  workspace source scan (`inWorkspace` + `workspaceUri`).
- Compatible with the **URI-as-recipe** stat/open model (chosen): the presence index lives in a
  **services-side cache** (relocated `buildClassToUriIndex`), NOT as provider entries — `getUriForFile`
  consults it, `readFile` on the org URI fetches lazily. The provider's in-memory tree data-model is
  unchanged.

**Revised apex-testing deferral scope** (supersedes the earlier "keep localUri ?? orgOnly for now"):
migrate `buildClassToUriIndex` into services as the workspace-presence resolver backing
`getUriForFile`/`isInWorkspace`; apex-testing calls `getUriForFile(org-metadata/ApexClass/<name>)`
instead of building + discarding the index.

### 10.5 §9.1 populate-trigger, corrected

§9.1 framed `readDirectory` as "the read-through populate trigger" backing the tree. Refined by §10:
`readDirectory` populates/answers the **org-metadata navigable structure** (Model 1's *filesystem-
shaped* analog for org-browser), while **content** for any owner is never eagerly written — it is
resolved lazily by `readFile` (§9.6 / §10.2). Structure-vs-content have separate lifecycles (as §5
anticipated): structure via `readDirectory`/presence, content via on-demand `readFile`, retained only
ephemerally.

---

## 11. The boundary — where discovery lives (SETTLED)

The unresolved question from the fork: *how much must physically move into services* (relocate whole
functions like `buildClassToUriIndex`) *vs. what can be captured at existing service-call seams* (e.g.
have `buildComponentSetFromSource` "silently capture" the discovery it already produces)? Two
questions — where the computation runs, and where its output is stored — were entangled. §11 separates
them and rules on both.

### 11.1 Ruling: discovery computation moves to services, generalized to all metadata types

**To make discovery available to all consumers in a uniform way, it moves into services and is
extended from ApexClass-only to all metadata types.** This is entailed, not optional: choosing the
**pull** model (services computes presence on demand, §8.4) *requires* the computation to live in
services. There is no pull model in which `buildClassToUriIndex`'s computation stays in apex-testing.

- The **computation** of `buildClassToUriIndex` (call `buildComponentSetFromSource`, read
  `getSourceComponents()`, dedup by shortest content path) **relocates into services.**
- It relocates **generalized**: not `classNames[] → Map<className, file:URI>` keyed by bare name, but
  a resolver over **any metadata type**, keyed by the canonical VFS path (§9.4), exposed as the §9.5
  helpers `getUriForFile` / `isInWorkspace` returning union state `{inOrg, inWorkspace, workspaceUri}`.
- The pull/push fork is one decision, not two: **pull ⇒ computation in services ⇒ `buildClassToUriIndex`
  relocates.** (Push — consumers compute and post discovery — is the *only* model where it would not
  move; it is rejected, §8.4/§11.3.)

### 11.2 Two stores, both loosely called "orgFs" — the distinction that removes the contradiction

§10.7 said both "the workspace discovery must **populate orgFs**" and "the presence index lives in a
**services-side cache … NOT as provider entries**." Those contradict *only* if "orgFs" means one
thing. It means two:

1. **Provider in-memory tree** — the concrete `root` of `Entry` objects in `orgDataFsProvider.ts`
   (dirs + file bytes). The **only** thing ever written here is `ephemeralContent` on a `readFile` of
   an org-only component (§9.6). Presence and directory structure are **never** persisted here.
2. **Services-side resolution cache** — the union `{inOrg, inWorkspace, workspaceUri}` per canonical
   key. This is where the relocated `buildClassToUriIndex` computation stores its result, keyed by org.

"Populate orgFs" with discovery = **store #2**. It is a **pull** cache (computed on demand, answers
resolution queries), not a **push** into the provider tree. The provider is a **read-through facade
over store #2** for presence, and a lazy fetch-and-hold for content — it is not where discovery is
recorded. This is fully consistent with the URI-as-recipe model.

### 11.3 The mechanism rule: read return values, never add population side effects

The boundary is **not** the two ends originally posed (relocate-verbatim vs. silent-capture). It is a
third thing, defined by a single rule:

> **Services reads the discovery already present in existing methods' return values. A method never
> grows a VFS-population side effect.**

- **Rejected — "silent capture":** mutating `buildComponentSetFromSource` to self-populate orgFs.
  It couples unrelated callers (retrieve/deploy also call it) to VFS population, makes freshness
  non-deterministic (populates only when someone happens to call it for another reason), and violates
  "provider is owner-agnostic."
- **Accepted:** existing methods stay **unchanged**; the new services resolver **calls them and
  projects their returns** into the union state. `buildComponentSetFromSource` stays as-is; the
  resolver reads `getSourceComponents()`. `listMetadata` stays as-is; the resolver reads its
  `FileProperties[]`.

So `buildClassToUriIndex`'s *logic* moves (§11.1), but as a **new resolver that consumes existing
methods** — not as a wrapper that changes them, and not as a captured side effect of them.

### 11.4 Services API inventory — what discovery each already returns

The ruling is grounded in fact: the two presence facts §9.4 needs are **already** in the return values
of two existing methods. Nothing about *acquiring* discovery changes; only the reshape/ownership does.

| Services API | Return value | Latent discovery | Presence fact |
|---|---|---|---|
| `MetadataDescribeService.describe()` | metadata **types** (org) | org-metadata root listing | — (type catalog) |
| `MetadataDescribeService.listMetadata(type, folder?)` | `FileProperties[]` (org) | every component of a type in the **org** | **`inOrg`** |
| `MetadataRetrieveService.buildComponentSetFromSource(dirs, members)` | `ComponentSet` → `getSourceComponents()` = `{name, type, content=local path}` | every component in the **workspace** + its path | **`inWorkspace` + `workspaceUri`** |
| `SourceTrackingService.getStatus()` / `get*AsComponentSet()` | local/remote change ComponentSets | inOrg ∩ inWorkspace + change/conflict state | delta refinement (deferred) |
| `ComponentSetService.getComponentSetFromProjectDirectories()` | project `ComponentSet` | workspace presence, project-wide | `inWorkspace` |
| `ProjectService.getSfProject()` / `getPackageDirectories()` | package dir paths | roots to scan (**input**, not discovery) | — |

`inOrg` is already produced cleanly by `listMetadata` (org-browser consumes it today). `inWorkspace +
workspaceUri` is already produced by `buildComponentSetFromSource` (apex-testing's
`buildClassToUriIndex` consumes it today and discards it). The relocated resolver **unions these two
return values** per canonical key — the components-level `readDirectory` for `org-metadata/<type>`.

### 11.5 What this settles

- Where discovery computes: **services** (pull model, §11.1).
- Scope: **all metadata types**, not ApexClass-only (§11.1).
- Where discovery is stored: **services resolution cache (store #2)**, not the provider tree; only
  ephemeral content ever enters the provider tree (§11.2).
- Mechanism: **read existing methods' return values**; no method gains a population side effect
  (§11.3).
- `buildClassToUriIndex`: its computation **relocates + generalizes** into the services resolver
  backing `getUriForFile`/`isInWorkspace`; apex-testing calls the helper instead of building +
  discarding the index (§11.1, confirms revised §10.7 scope).

---

## 12. Full relocation inventory — everything needed to maintain orgFs (SETTLED scope map)

The "easy" question: beyond `buildClassToUriIndex`, **what else must relocate into services to keep the
resolution cache (store #2, §11.2) authoritative?** A cache is only trustworthy if services owns *all
four* of: (A) how presence is **computed**, (B) how org **source is fetched**, (C) the **events that
change presence**, and (D) the **workspace file add/change/delete events** that mutate it between those.
Swept the monorepo along all four axes. Findings below; each row is a relocate-or-wire item.

### 12.1 Axis A — workspace-presence computation (must relocate INTO the resolver)

These sites each compute "does this component exist locally, and where" — the `inWorkspace` +
`workspaceUri` half of the union. Today computed independently by ≥2 consumers and discarded.

| Site | What it computes today | Disposition |
|---|---|---|
| `apex-testing/utils/testUtils.ts:86` `buildClassToUriIndex` | `Map<className, file:URI>` via `buildComponentSetFromSource` | **Relocate + generalize** → the §11.1 resolver (already ruled). |
| `org-browser/tree/metadataTypeTreeProvider.ts:274,295,316,332,351` | `filePresent` per node via `getComponentSetFromProjectDirectories().getComponentFilenamesByNameAndType()` | **Relocate** → `filePresent` becomes `isInWorkspace(canonicalUri)` from the resolver (§8.2 already said this; §12 confirms the exact call sites). |
| `org-browser/tree/customField.ts:16` | CustomField presence (monolithic-format special case) | **Relocate** into the resolver's per-type presence logic (CustomField is the known `ComponentSet.has()===false` edge). |
| `org-browser/commands/retrieveMetadata.ts:28,70` | project ComponentSet + field-path presence to decide retrieve targets | **Consume** the resolver (read presence) rather than recompute; this is also a **producer** of a presence change — see Axis C. |

`ComponentSetService.getComponentSetFromProjectDirectories()` itself **stays in services** (it already
lives there); what relocates is the *per-component presence projection* the consumers wrote on top of
it. **The four rows above were confirmed by a hand-check + an exhaustive monorepo sweep (§12.7); the
sweep also found MORE presence duplication I had wrongly pre-excluded — see §12.7 for the corrected,
complete list.** LWC/Aura/Visualforce *language-server* indexers (`salesforcedx-lwc-language-server`,
`salesforcedx-lightning-lsp-common`, etc.) remain out of scope — they index files for language
features, not metadata presence. **But the vscode-facing lwc/lightning *extension* commands are NOT
exempt (§12.7) — I conflated the two and must not repeat that.**

### 12.2 Axis B — on-demand org source fetch (must relocate as the `readFile` resolver)

The lazy "fetch this component's body from the org" logic — the §9.6 / §10.2 `readFile` resolver.

| Site | What it fetches | Disposition |
|---|---|---|
| `apex-testing/utils/orgApexClassProvider.ts` | `sf-org-apex` TextDocumentContentProvider: Tooling SOQL `SELECT Body FROM ApexClass`, managed `(hidden)` handling, 5-min cache | **Relocate** its fetch logic → the `org-metadata/ApexClass` `readFile` resolver in services. Delete the `sf-org-apex` provider (wrong scheme, §10.2). |
| `apex-testing/views/apexTestTreeService.ts` / `discoveryVfs/apexTestDiscoveryService.ts` | eager `writeOrgData(classUri, body)` bulk write | **Delete** (§10.2/§10.4) → replaced by presence registration + lazy `readFile`. |
| `org-browser` preview (stories 2/3, `metadata-preview` owner) / experiment's `retrieveMemberContent` | single-component retrieve-to-VFS on click | **Reconcile, don't relocate blindly:** this is the generic content-fetch the `org-metadata` `readFile` resolver generalizes. Stays a separate content-bearing concern; the resolver is where per-type "how do I fetch source" plugs in (parked: §9.8 "what open means per type"). |

Non-metadata content providers matched by the sweep — `apex-log` trace-flag content provider,
`apex/embeddedSoql` — are **out of scope** (not metadata-component source).

### 12.3 Axis C — presence-change signals (must be OWNED/observed by services)

Events that flip `inWorkspace` or `inOrg` after initial computation. The cache is wrong the moment one
of these fires unobserved.

| Signal | Where | Disposition |
|---|---|---|
| **Retrieve-to-workspace completes** → `inWorkspace` flips true | `MetadataRetrieveService.retrieve` / `retrieveComponentSet` (already in services); fired by org-browser `retrieveMetadata`, metadata `projectRetrieveStart`, and the CodeLens "download" | Services **already owns the retrieve**; the resolver updates presence in the retrieve completion path (this is §8.4's "push" — recorded in store #2, not the provider tree). "A fetch by one consumer is a fetch for all." |
| **Deploy / delete completes** → `inOrg` may flip | `MetadataDeployService`, `metadataDeleteService` (already in services) | Same — observe completion, update `inOrg`. Likely **defer** (org-side delta overlaps source-tracking; §7-deferred). |
| **Org list/describe** → sets `inOrg` | `MetadataDescribeService` (already in services) | Already the pull source (§11.4); the resolver's `inOrg` half. No relocation — it's home. |
| **Org change** → whole cache invalid | `defaultOrgRef` / lifecycle reactor `orgDataLifecycle.ts` (already in services) | Existing reactor purges foreign-org data; extend to clear the resolution cache. Already services-owned. |
| **Manual tree refresh** → invalidates *org* cache only | `org-browser metadataTypeTreeProvider.ts:123 invalidateForNode` | Today invalidates only `MetadataDescribeService` (org side), **never workspace presence** — see the Axis-D bug. Rewire to invalidate the resolver. |

The important finding: **every presence-changing operation on the org side is ALREADY services-owned**
(retrieve, deploy, delete, describe, org-change). Axis C requires almost no relocation — only *wiring
the resolver's cache-update into completion paths services already controls.*

### 12.4 Axis D — workspace file add/change/delete (the resolver's live-truth feed)

The user's addition, and the axis that makes the cache trustworthy between retrieves. If a user
creates/deletes a `.cls` on disk (git checkout, external tool, manual new file), `inWorkspace` must
follow **without** a manual refresh.

**Pleasant finding — the watcher already lives in services and is unused by presence:**

- `salesforcedx-vscode-services/src/vscode/fileWatcherService.ts:22` — a single
  `vscode.workspace.createFileSystemWatcher('**/*')` already emits `create` / `change` / `delete`
  into…
- `salesforcedx-vscode-services/src/vscode/fileChangePubSub.ts` — a pub/sub the VS Code wiring writes
  and consumers subscribe to **read-only**.

So Axis D needs **no new watcher and no relocation** — the resolution cache **subscribes to
`fileChangePubSub`**: on create/delete of a file that maps to a canonical component path, flip
`inWorkspace`/`workspaceUri` and fire the provider's `onDidChangeFile` so open editors + trees re-read.
This is the mechanism §8.4's "push" and §9.4's live union both assumed but never named.

**Latent bug this fixes (evidence for the whole effort):** org-browser's `filePresent` is
**stale between manual refreshes today.** `invalidateForNode` (§12.3) reacts only to explicit
`refreshType` + org-change; it never observes workspace file events. Create/delete a component on disk
and the presence icon does not update until the user refreshes. The services-owned resolver subscribed
to `fileChangePubSub` corrects this for **every** consumer at once — a concrete correctness win, not
just consolidation.

### 12.5 The relocation list, consolidated

**Relocate (logic physically moves into the services resolver):**
1. `buildClassToUriIndex` → generalized workspace-presence computation (Axis A, §11.1).
2. org-browser `filePresent` / `getComponentFilenamesByNameAndType` projection + `customField.ts`
   presence → `isInWorkspace` (Axis A).
3. `orgApexClassProvider` org-body fetch → `org-metadata/ApexClass` `readFile` resolver (Axis B).

**Delete (superseded by the resolver):**
4. apex-testing eager `writeOrgData` body loop (`apexTestDiscoveryService`) + the `sf-org-apex`
   provider (Axis B).

**Wire (no relocation — connect services-owned events to the resolver's cache):**
5. Retrieve/deploy/delete completion → cache update (Axis C; all already services-owned).
6. `fileChangePubSub` subscription → live `inWorkspace` update + `onDidChangeFile` (Axis D; watcher
   already services-owned).
7. Org-change/lifecycle reactor + `invalidateForNode` → clear/refresh the resolution cache (Axis C/D).

**Consumers repoint (call the resolver instead of computing):**
8. org-browser tree `getChildren`/presence, apex-testing open-target, retrieve-target selection.

**Explicitly OUT of scope:** LWC/Aura/VF LSP component indexes; apex-log & embeddedSoql content
providers; sync-state/source-tracking deltas (deferred, §3/§7); the stories-2/3 `metadata-preview`
content owner (reconciled as the generic `readFile` plug-point, not folded in this pass).

### 12.7 Exhaustive sweep — the COMPLETE presence/fetch/URI-resolution duplication map

§12.1's four rows were a hand-check. A full sweep of **every** extension package (each confirmed by
reading excerpts) found the complete set. **It reversed a wrong pre-exclusion of mine:** I had
dismissed all LWC/Aura hits as "language-server indexers, out of scope." That is true for the
*language servers*, but the vscode-facing **extension commands** (`renameLwc`, `createLwc`,
`renameAura`) independently compute workspace presence and are legitimate targets. Recording the
correction so it is not lost.

Two-bucket split — the distinction that matters for scope:

- **Bucket 1 — REQUIRED to maintain orgFs** (compute the union / fetch org source / resolve open URI
  for org-metadata components; leaving these duplicated keeps the discard alive):

  | Site | Pattern | Note |
  |---|---|---|
  | `apex-testing/utils/testUtils.ts:86` `buildClassToUriIndex` | 1 | known example; relocate+generalize (§11.1). |
  | `apex-testing/utils/orgApexClassProvider.ts:21-51,77-120,138-143` | 2+3 | `lookupClassBody` Tooling `SELECT Body`, `sf-org-apex` content provider, `createOrgApexClassUri`. Relocate fetch → `readFile`; delete provider. |
  | `apex-testing/index.ts:68-72` | 2 | registers `sf-org-apex` provider → delete. |
  | `apex-testing/views/orgTestItems.ts:200-202` | 3 | `localUri ?? orgOnlyClassUri` → `getUriForFile`. |
  | `apex-testing/views/apexTestTreeService.ts:475,906,958-960` | 3 | `orgOnlyClassUri` factory + second `localUri ?? …` site. |
  | `apex-testing/views/apexTestTreeService.ts:527-559` `fetchClassBodiesByFullName` | 2 | `SELECT Body … WHERE Id IN(...)` bulk body pull → subsumed by lazy `readFile`. |
  | `apex-testing/discoveryVfs/apexTestingClassUri.ts:22-34` | 3 | class↔URI bijection → canonical `org-metadata/ApexClass` key. |
  | `apex-testing/discoveryVfs/apexTestDiscoveryService.ts:26-52` `saveDiscoveredClasses` | 2 | eager body write → **delete** (§10.2). |
  | `apex-testing/views/testController.ts:259-283,370-399` `retrieveOrgOnlyClass(FromUri)` | 2+3 | single-ApexClass retrieve + open retrieved file → the retrieve is the presence-flip (Axis C); open via `getUriForFile`. |
  | `apex-testing/retrieve/orgOnlyRetrieveCodeLensProvider.ts:11-21` | 3 | "download into workspace" lens on org-only source → the §8.2 code lens, now on the shared entry. |
  | `org-browser/tree/metadataTypeTreeProvider.ts:316,332,347-363,376-393` | 1 | `filePresent` via `getComponentFilenamesByNameAndType` → `isInWorkspace`. |
  | `org-browser/tree/customField.ts:12-27` | 1 | CustomField presence (monolithic-format edge) → resolver per-type logic. |
  | `org-browser/commands/retrieveMetadata.ts:28,66-77` `isMemberPresentInProject` | 1 | `.has()` + CustomField fallback overwrite check → consume resolver. |

- **Bucket 2 — SAME duplication the resolver eliminates, but NOT required for orgFs** (these compute
  the identical workspace-presence / canonical-correlation the resolver will own, so they *should*
  consume it to kill the duplication — but org-metadata VFS functions correctly if they are left
  alone; fold in opportunistically or as fast-follows, do not let them bloat the core WI):

  | Site | Pattern | Note |
  |---|---|---|
  | `vscode-lwc/commands/renameLwc.ts:66-75`, `createLwc.ts:62-72` | 1 | project-wide LWC+Aura `getSourceComponents` → "existing names" collision set. |
  | `vscode-lightning/commands/renameAura.ts:64-70` | 1 | identical LWC+Aura presence set. **(All three share one computation — a single relocation.)** |
  | `vscode-metadata/shared/diff/diffHelpers.ts:67-110` `matchUrisToComponents` | 1+3 | canonical `{type,fullName}` correlation of local↔remote paths → the resolver's correlation, consumed for diff. |
  | `vscode-metadata/conflict/conflictDetection.ts:37,47-57` | 1+3 | `.has()` filter + local/remote pairing via `matchUrisToComponents`. **Overlaps deferred source-tracking (§3/§7) — likely defer with it.** |

  **Borderline / explicitly NOT targets** (verified, recording so they are not re-litigated):
  `org-browser/services/orgBrowserMetadataRetrieveService.ts` (plain retrieve-to-disk, excluded by
  §12.2); `vscode-metadata/services/deployOnSaveService.ts` + `commands/sourceDiff.ts` +
  `shared/diff/diffComponentSet.ts` (deploy scoping / consumers of `matchUrisToComponents`, no new
  logic); `vscode-metadata/commands/projectInfo.ts:49` (sums file sizes for a report — no presence/
  resolution).

- **Confirmed clean (NOTHING relevant):** `vscode-apex` (LSP client + embedded-SOQL content provider),
  `vscode-apex-debugger`, `vscode-apex-replay-debugger`, `vscode-apex-log` (trace flags/logs —
  excluded category), `vscode-apex-oas`, `vscode-core` (`metadataSupport` = registry hover/docs only),
  `vscode-org`, `vscode-soql`/`soql-common`/`soql-model`, `vscode-visualforce` (create commands already
  delegate overwrite checks to services), and all language-server / non-extension support packages.

**Net correction to §12.5's relocate list:** add `testController.retrieveOrgOnlyClass` +
`orgOnlyRetrieveCodeLensProvider` (Bucket 1, apex-testing, were implicit under "consumers repoint" but
are concrete relocate/rewire sites). Bucket 2 (lwc/lightning create+rename, metadata diff/conflict)
is **new** — not previously in the inventory — and is the answer to "any additional `buildClassToUriIndex`
instances": **yes, three more presence computations (lwc/aura create+rename) and one canonical-correlation
(metadata diff), none of which is required for orgFs to work but all of which the same resolver
subsumes.**

### 12.6 The through-line

Almost everything on the org side is **already in services** (describe, list, retrieve, deploy,
delete, connection, the file watcher, the pub/sub, the lifecycle reactor). The relocation is **not a
large migration of infrastructure** — it is (a) moving the handful of **presence *projections*** two
consumers wrote independently (Axis A), (b) moving **one org-body fetch** (Axis B), and (c) **wiring
already-owned events** to a new resolution cache (Axes C/D). The scope is dominated by *deletion of
duplication* and *event wiring*, not by new machinery. That is the strongest evidence the orgFs
consolidation is the right shape: the data and events already belong to services; only the derived
answers currently leak into consumers.
