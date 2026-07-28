# Plan: A reusable Code Builder e2e toolkit

**Status:** Draft for review
**Author:** planning session (grill-me)
**Related:** PR [#7718](https://github.com/forcedotcom/salesforcedx-vscode/pull/7718) (W-23385030) · ADR [0022](../adr/0022-code-builder-e2e-desktop-build-over-browser.md)
**Working package name:** `@salesforce/code-builder-e2e`

---

## 1. Context & Motivation

Code Builder (Agentforce Vibes) serves a Salesforce-customized **code-server** with a
**Node extension host** behind a browser UI. It runs the **desktop** extension build, and
its e2e suite runs the existing desktop Playwright specs driven by a browser client pointed
at the container URL (ADR 0022). PR #7718 proved this end-to-end: pull the published
`workspace-manager/codebuilder` image, swap the unreleased monorepo VSIXes into the running
container at runtime, restart to re-scan and re-auth, gate on installed versions, then run
the specs — with **zero changes to `code-builder-images`**.

#7718 works, but it is **scripts, not a toolkit**. The swap, verify, seed, and lifecycle
logic live as standalone `ts-node` scripts (`codeBuilderSwapExtensions.ts`,
`codeBuilderVerifyExtensions.ts`, `codeBuilderSeedWorkspace.ts`, `codeBuilderLocalE2E.ts`)
wired specifically to this repo's extension set. Two forces motivate turning that proven
work into a reusable package:

1. **Reusability.** Every capability that touches the Code Builder image — VSIX swap,
   container lifecycle, version/content gating, workspace seeding, org boot-env injection —
   is generic to *any Salesforce team* running e2e against the same image with their own
   VSIXes. Today none of it is importable; a second team would copy-paste and re-derive the
   hard-won lessons.

2. **A known correctness bug that the redesign must close.** ADR 0022 documents the
   **false-green** risk: the current gate compares **installed semver, not bytes**. When an
   unreleased build shares a version with the baked copy (pre-release builds are not
   version-bumped), a swap that silently no-ops still passes the gate (`67.4.0 == 67.4.0`
   against the leftover baked copy). The ADR names the fix — **unconditional wipe by
   publisher glob + a content check** — but #7718 has not adopted it, and the swap/verify
   scripts share no code, so a content check *cannot* reconcile across the two sides as they
   stand. Closing this is a structural change, and the package is where it lands.

This plan turns #7718's proven pipeline into a layered, incrementally-delivered package,
recycling what is sound and redesigning the two things that must change: **the swap wipe
must be unconditional-by-publisher-glob** and **swap + verify must share a digest core** so
a content check can prove *the bytes under test are the bytes intended*.

---

## 2. Goals, Non-Goals & Constraints

### Goals

- **G1 — Importable TS library.** Ship `@salesforce/code-builder-e2e` exposing the pipeline
  as importable functions. Consumers write their own thin orchestrator by composing them.
- **G2 — Close the false-green.** Verify proves the installed extension is the intended
  bytes (composite content digest), not merely the intended semver. Swap guarantees a clean
  slate so no stale dir can survive to be falsely green.
- **G3 — Reuse-first for other Salesforce teams.** Every brick is generic to the CB image
  and parameterized (publisher prefix, image ref, org, fixture) so another Salesforce team
  adopts it with a thin wiring layer, not a fork. Build the generic case first; repo
  specifics are a top layer.
- **G4 — Incremental delivery.** Each brick is independently useful and shippable before the
  full system exists. Shipping order is **verify → swap → lifecycle → auth/seed →
  orchestrator + CI**.
- **G5 — Recycle #7718.** Preserve the proven pipeline shape (pull → swap → restart →
  gate → run), the `execFileSync`-with-arg-arrays idiom, the `playwright-vscode-ext`
  fixtures, and the fixture-mount seeding approach. Flag and redesign only what must change.

### Non-Goals

- **NG1 — Not a generic any-container toolkit.** This is a **Code Builder /
  workspace-manager image toolkit**. It is allowed to hard-know CB internals
  (`/base/extension-overrides`, runtime symlink dir, restart-to-rescan, `coder.json`,
  `start.sh` boot semantics). "Other teams" means other *Salesforce* teams on the **same
  image**, not a different image family. The image layout is **not** an abstracted pluggable
  adapter.
- **NG2 — The package does not source VSIXes.** Building (from working tree) and downloading
  (by Build All runId) are deeply repo-specific (`vscode:package`, the legacy/modern dance,
  wireit). The package starts at "here are VSIX paths." Sourcing lives in the repo's thin
  orchestrator.
- **NG3 — The package does not select/dedup VSIXes.** Swap takes an **explicit list**. The
  modern-vs-legacy (67.x) dedup is the consumer's job.
- **NG4 — No forced Effect buy-in.** The core is consumable without Effect. This repo, being
  Effect-native, wraps it; adopters not on Effect can still use every brick (see §15).
- **NG5 — No second team shipping target yet.** This monorepo is the **first and only**
  consumer. "Other Salesforce teams" is an honored **design constraint**, not a delivery
  milestone.

### Constraints

- **C1 — Package owns the docker lifecycle.** `docker` is a package dependency; `pull`,
  `run`, `restart`, `teardown` are package verbs (§7). This is a deliberate choice over
  "operate on a container the consumer runs."
- **C2 — Desktop build only.** The digest keys off `main`; `browser` is ignored (ADR 0022).
- **C3 — Do not rely on contracts `code-builder-images` can move under us** without a loud
  failure. The version/content gate is the safety net; the fixture **mount** (not the
  `SFDX_COBU_*` first-boot path) is the seeding mechanism.
- **C4 — Rolling `:latest` by default.** A CB image change can shift the baseline; that is
  the honest "what's live now" signal (image tag is a parameter).

---

## 3. Architecture Overview

### 3.1 Two layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  REPO ORCHESTRATOR LAYER  (thin, repo-specific — NOT in the package)  │
│                                                                       │
│  • VSIX sourcing:  build-from-working-tree  |  download-by-runId      │
│  • VSIX selection/dedup:  modern vs legacy (67.x)                     │
│  • local command:  test:container:local  (scripts/codeBuilderLocalE2E)│
│  • CI workflow:  codeBuilderE2E.yml  (workflow_call into e2e.yml)     │
│  • wiring: publisher prefix, image ref, org alias, fixture path       │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ imports & composes
┌───────────────────────────────▼───────────────────────────────────────┐
│  PACKAGE  @salesforce/code-builder-e2e  (generic CB-image toolkit)      │
│                                                                         │
│   Lifecycle ── run/pull/restart/teardown ──► ContainerHandle (typed)    │
│   Auth      ── resolveOrgBootEnv(alias) (opt, sf-aware) ──► BootEnv      │
│   Swap      ── (handle, vsixPaths[], prefix) ──► Manifest  (mutates)     │
│   Seed      ── (handle, fixturePath) ──► void            (mutates)      │
│   Verify    ── (handle, Manifest) ──► assertion          (pure)         │
│         └────────────── Digest core (shared internal) ──────────────┘   │
│                                                                         │
│   Runner seam (plain injected fn; Effect adapter available) ── §15      │
└─────────────────────────────────────────────────────────────────────┘
```

The same split as a component view — note every arrow crosses the boundary **downward**
(the repo layer depends on the package, never the reverse), and everything docker-facing
funnels through the runner seam:

```mermaid
flowchart TB
    subgraph REPO["REPO ORCHESTRATOR LAYER (repo-specific, NOT in package)"]
        direction TB
        SRC["VSIX sourcing<br/>build-from-tree | download-by-runId"]
        DEDUP["VSIX selection / dedup<br/>modern vs legacy 67.x"]
        LOCAL["local command<br/>test:container:local"]
        CI["CI workflow<br/>codeBuilderE2E.yml"]
        WIRE["wiring: publisher prefix,<br/>image ref, org alias, fixture path"]
    end

    subgraph PKG["PACKAGE @salesforce/code-builder-e2e (generic CB-image toolkit)"]
        direction TB
        LIFE["Lifecycle<br/>pull / run / restart / teardown"]
        AUTH["Auth<br/>resolveOrgBootEnv (opt, sf-aware)"]
        SWAP["Swap<br/>wipe + install + emit Manifest"]
        SEED["Seed<br/>coder.json + trust writes"]
        VERIFY["Verify<br/>pure content + version assertion"]
        DIGEST(["Digest core<br/>entrypoint resolver + composite digest"])
        RUNNER{{"Runner seam<br/>injected fn (+ Effect adapter)"}}

        SWAP --> DIGEST
        VERIFY --> DIGEST
        SWAP --> RUNNER
        VERIFY --> RUNNER
        LIFE --> RUNNER
        SEED --> RUNNER
        AUTH --> RUNNER
    end

    REPO ==>|imports & composes| PKG
    RUNNER -.->|execFileSync docker ...| DOCKER[("docker / CB image")]

    classDef repo fill:#eef6ff,stroke:#4a90d9,color:#123;
    classDef pkg fill:#f3fbef,stroke:#5aa457,color:#123;
    class SRC,DEDUP,LOCAL,CI,WIRE repo;
    class LIFE,AUTH,SWAP,SEED,VERIFY,DIGEST,RUNNER pkg;
```

### 3.2 The two spine objects

Everything threads through two typed objects (both **Effect Schema** — §4, §15):

- **`ContainerHandle`** — returned by `run`, accepted by every other verb.
  `{ name, imageRef, publishedUrl, publishedPort, bootEnv }`. Downstream bricks never
  re-derive the URL or the boot env.
- **`Manifest`** — `name → version → { pkgJsonDigest, bundleDigest | null }`. **Emitted by
  swap, consumed by verify**, persisted to disk. It is both the swap→verify contract *and*
  the provenance artifact (the thing #7718 currently hand-rolls into log lines).

### 3.3 Brick dependency graph (delivery order)

```
  Digest core ──► Verify (brick #1, first shippable)
       │
       └────────► Swap (brick #2)  ──emits──► Manifest ──► Verify
                    │
  Lifecycle (brick #3) ──ContainerHandle──► Swap, Seed, Verify
       │
  Auth/BootEnv (brick #4) ──► Lifecycle.run
  Seed (brick #4) ──► (post-boot, on a handle)
       │
  Repo orchestrator (§7) composes all of the above
```

As a dependency graph (edge = "depends on / consumes"; the shaded node is the first
externally-shippable brick):

```mermaid
flowchart LR
    DIGEST(["Digest core (M1)"])
    MAN(["Manifest schema (M1)"])
    VERIFY["Verify (M2)"]
    SWAP["Swap (M3)"]
    LIFE["Lifecycle (M4)"]
    AUTH["Auth / BootEnv (M5)"]
    SEED["Seed (M5)"]
    ORCH{{"Repo orchestrator + CI (M6)"}}

    DIGEST --> VERIFY
    DIGEST --> SWAP
    MAN --> SWAP
    MAN --> VERIFY
    SWAP -->|emits| MAN
    LIFE -->|ContainerHandle| SWAP
    LIFE -->|ContainerHandle| SEED
    LIFE -->|ContainerHandle| VERIFY
    AUTH -->|BootEnv| LIFE
    VERIFY --> ORCH
    SWAP --> ORCH
    LIFE --> ORCH
    AUTH --> ORCH
    SEED --> ORCH

    classDef first fill:#fff3cd,stroke:#d9a441,color:#123,stroke-width:2px;
    class VERIFY first;
```

Verify ships first because it is independently useful (assert correctness after a *manual*
swap) **and** it is the brick carrying the known correctness risk — getting its contract
right de-risks everything downstream.

### 3.4 Runtime pipeline (end-to-end sequence)

How the composed system runs one e2e pass. The orchestrator (repo layer) drives; every
docker action goes through the package's runner seam. Note the **restart between swap and
verify** — that is the single lever that both re-scans the overrides *and* re-runs org auth
(§7.1), and verify only ever sees a fully-booted, swapped host.

```mermaid
sequenceDiagram
    autonumber
    participant O as Orchestrator (repo)
    participant A as Auth (resolveOrgBootEnv)
    participant L as Lifecycle
    participant S as Seed
    participant W as Swap
    participant V as Verify
    participant D as docker / CB image
    participant P as Playwright specs

    O->>A: resolveOrgBootEnv(alias)
    A->>A: sf org auth show-access-token (NOT org display)
    A-->>O: BootEnv { accessToken, instanceUrl }
    O->>L: pull(imageRef)
    L->>D: docker pull
    O->>L: run({ bootEnv, mount, readiness })
    L->>D: docker run -e … -v fixture:/…
    L->>D: poll workbench URL until healthy
    L-->>O: ContainerHandle { name, url, … }
    O->>S: seedWorkspace(handle, fixturePath)
    S->>D: docker exec: write coder.json + trust setting
    O->>W: swap(handle, vsixPaths[], { publisherPrefix })
    W->>D: wipe {prefix}.* override dirs + runtime symlinks
    W->>W: host-side unpack + digest each VSIX
    W->>D: docker cp extracted trees into /base/extension-overrides
    W-->>O: Manifest (name→version→digests)
    O->>O: persist manifest.json (provenance)
    O->>L: restart(handle)
    L->>D: docker restart (re-scan overrides + re-run org auth)
    L->>D: poll workbench URL until healthy
    O->>V: verify(handle, Manifest)
    V->>D: docker cp override dirs OUT to host
    V->>V: recompute digests, assert 1 dir/ext + digests match
    V-->>O: pass / fail-loud
    O->>P: run specs (browser → container URL)
    P-->>O: results
    O->>L: teardown(handle)
    L->>D: docker rm -f
```

---

## 4. The Manifest & Digest Contract

This is *the* correctness knob for the whole system, so it is specified before any brick.

### 4.1 The reconciliation problem

The digest must be computable **identically on both sides of the unpack transformation**,
and the two sides are **not the same bytes**:

- **Pre-install (swap side):** a `.vsix` is a **zip archive**.
- **Post-install (verify side):** the CB image consumes **extracted override *dirs*** at
  `/base/extension-overrides/{prefix}.<name>-<version>/` — loose files on disk, not the zip.

So `sha256(the .vsix)` is meaningless to verify. The digest is defined over content that
**survives unpacking**, and is computed on the **extracted tree** on both sides (swap
extracts host-side before install; verify copies the extracted dir back out — §5, §6).

The two sides must arrive at the *same* digest through different paths — this is the crux
that forces swap and verify to share one digest core (§4.4):

```mermaid
flowchart TB
    subgraph SWAPSIDE["SWAP side (pre-install)"]
        Z[".vsix (zip archive)"] -->|host-side unpack| ET1["extracted tree (host)"]
        ET1 --> DC1(["digest core"])
        DC1 --> M["Manifest entry<br/>{ pkgJsonDigest, bundleDigest }"]
    end

    subgraph VERIFYSIDE["VERIFY side (post-install)"]
        OD["/base/extension-overrides/<br/>{prefix}.name-version/ (in container)"]
        OD -->|docker cp OUT| ET2["extracted tree (host temp)"]
        ET2 --> DC2(["digest core (SAME code)"])
        DC2 --> RD["recomputed digest"]
    end

    M -.->|must equal| RD
    RD --> CMP{"match?"}
    CMP -->|yes| PASS["✓ intended bytes installed"]
    CMP -->|no| FAIL["✗ fail loud: swap didn't take"]

    classDef ok fill:#f3fbef,stroke:#5aa457,color:#123;
    classDef bad fill:#fdecea,stroke:#d9534f,color:#123;
    class PASS ok;
    class FAIL bad;
```

### 4.2 The composite digest (the contract)

Each extension's digest has **two parts**, both required:

1. **`pkgJsonDigest`** — `sha256` of the extension's `extension/package.json`. Cheap; present
   on both sides; changes when name/version/`main`/`packageUpdates`/etc. change. **Weakness on
   its own:** two builds with identical `package.json` but different bundle bytes collide.
2. **`bundleDigest`** — `sha256` of the actual shipped bundle entry file resolved from the
   `main` field. This is what really differs build-to-build and catches a bundle-only change
   that `pkgJsonDigest` misses.

Together: cheap gate + byte-level catch. Middle-ground for speed — we **do not** hash the
full recursive tree (unpack nondeterminism, files the image may add, brittleness); we hash
two well-defined files.

### 4.3 Strictness policy

The entrypoint resolver reads `extension/package.json` and resolves `main`:

| Case | Behavior |
|---|---|
| `main` present and resolves to a file | `bundleDigest = sha256(that file)` |
| `main` **absent** | **Valid** — `bundleDigest = null`, digest is package.json-only. A declarative-only extension (grammars/snippets/themes/`extensionPack`) legitimately has no bundle to catch. |
| `main` **present but unresolvable** | **Hard error.** A declared entrypoint that isn't there is a real broken build/swap — this is where "strict" earns its keep. |
| `browser` field | **Ignored.** CB runs the desktop/node build (ADR 0022). |

### 4.4 Shared entrypoint resolver + digest = one internal utility

**Departure from #7718:** swap and verify are currently separate scripts with no shared
code. Because the digest must match on both sides, they now **must** share:

- the **entrypoint resolver** (given an extension root — zip-extracted host dir or
  copied-out container dir — read `package.json`, resolve `main`, return path + bytes), and
- the **digest function** (produce `{ pkgJsonDigest, bundleDigest }` from an extracted root).

Factor both into **one internal digest-core module** both bricks depend on. Two copies would
be a correctness bug waiting to happen.

### 4.5 Schema & persistence

- **`Manifest` is an Effect Schema**, parsed/validated at every boundary and serialized to a
  `manifest.json`. Persisting it means CI can upload it and a human can diff *what we intended
  to test* — it subsumes #7718's hand-rolled provenance log block.
- Verify **holds no state and has no memory of the swap** — it takes the persisted (or
  in-memory) `Manifest` as its expected side and asserts. (Q4 decision: swap remembers what
  it installed *by emitting the manifest*; verify is a pure assertion over it.)

---

## 5. Brick #1 — Verify (first shippable)

**Contract:** pure assertion. **No mutation, no memory, no `sf`, no docker beyond `docker cp`.**

```
verify(handle: ContainerHandle, expected: Manifest): assertion
```

**What it does:**

1. For each entry in `expected`, `docker cp` the installed override dir
   (`/base/extension-overrides/{prefix}.<name>-<version>/`) **out** of the container to a
   host temp dir. *(Copy-out then hash on host — chosen for portability over speed; no
   dependency on in-container hashing tools; the slowness is acceptable.)*
2. Recompute `{ pkgJsonDigest, bundleDigest }` on the copied-out tree via the **shared digest
   core** (§4.4).
3. Assert, per extension: **exactly one** override dir at the expected id/version **and**
   both digests match the manifest. `bundleDigest: null` in the manifest ⇒ assert
   package.json-only (declarative extension).
4. Fail **loud** with a per-extension diff (expected vs actual digest, missing dir, duplicate
   dir) — a mismatch means *the swap didn't take*, not a test bug (surface this in the message,
   per the skill doc's existing framing).

The per-extension assertion, as a decision flow (all four gates must pass; any failure is
loud, never green):

```mermaid
flowchart TD
    START["for each Manifest entry"] --> COUNT{"exactly 1 override<br/>dir at id-version?"}
    COUNT -->|0 dirs| F1["✗ missing — swap didn't install"]
    COUNT -->|"2+ dirs"| F2["✗ duplicate — stale dir survived (false-green averted)"]
    COUNT -->|1 dir| CP["docker cp dir OUT → host temp"]
    CP --> PKG{"pkgJsonDigest<br/>matches?"}
    PKG -->|no| F3["✗ package.json differs"]
    PKG -->|yes| HASBUNDLE{"manifest has<br/>bundleDigest?"}
    HASBUNDLE -->|"null (declarative ext)"| PASS["✓ pass (package.json-only)"]
    HASBUNDLE -->|"present"| BUN{"bundleDigest<br/>matches?"}
    BUN -->|no| F4["✗ bundle bytes differ"]
    BUN -->|yes| PASS

    classDef bad fill:#fdecea,stroke:#d9534f,color:#123;
    classDef ok fill:#f3fbef,stroke:#5aa457,color:#123;
    class F1,F2,F3,F4 bad;
    class PASS ok;
```

**Standalone usefulness:** valuable even with nothing else built — hand-swap extensions,
hand-write a manifest (or reuse one swap emitted), and assert correctness. It is also the
foundation the CI gate step calls.

**Recycled from #7718:** the "exactly one dir per id at expected version" assertion and the
on-disk-`package.json` (activation-independent) approach.
**Redesigned:** adds the **content digest** (the false-green fix) and consumes a **typed
Manifest** rather than re-deriving expectations from the built-vsix dir.

---

## 6. Brick #2 — Swap

**Contract:** clean-slate install of an explicit VSIX list; emits the manifest.

```
swap(handle: ContainerHandle, vsixPaths: string[], opts: { publisherPrefix | prefixes }): Manifest
```

**What it does:**

1. **Unconditional wipe by publisher glob** (the ADR-recommended reliability fix). For each
   consumer-supplied prefix, delete **both**:
   - override dirs: `/base/extension-overrides/{prefix}.*`, and
   - **runtime symlinks**: `/home/codebuilder/.local/share/code-server/extensions/{prefix}.*`.

   > **Load-bearing (ADR 0022):** `start.sh` re-links an override into the runtime dir *only
   > when it is strictly-newer semver* than what's already linked. Clearing **both** locations
   > is what makes an equal-or-lower VSIX (the real pre-release-not-version-bumped case) load
   > at all. Wiping by **publisher glob** (not a hardcoded id list) ensures a baked extension
   > under an unlisted id cannot survive to be falsely green.

2. For each VSIX path (explicit list — **no directory scan, no dedup**; selection is the
   consumer's job per NG3): **unpack host-side**, compute its digest via the shared core,
   then `docker cp` the **extracted tree** into a fresh
   `/base/extension-overrides/{prefix}.<name>-<version>/`. *(Host-side unpack + cp the tree —
   the image consumes extracted dirs, not `.vsix` files; confirmed against #7718.)*
3. Return the **`Manifest`** of exactly what was installed (name→version→digests), for verify
   to assert against and for the orchestrator to persist.

**Note:** swap **mutates** but does **not** restart — applying the swap (re-scan + activation)
is `restart`'s job (§7). Sequence stays: `swap → restart → verify`.

Swap as a flow — the wipe clears **both** locations before any install, so nothing stale can
survive into verify:

```mermaid
flowchart TD
    IN["swap(handle, vsixPaths[], { publisherPrefix })"] --> WIPE1["wipe /base/extension-overrides/{prefix}.*"]
    WIPE1 --> WIPE2["wipe runtime symlinks<br/>~/.local/share/code-server/extensions/{prefix}.*"]
    WIPE2 --> LOOP{"for each VSIX<br/>in explicit list"}
    LOOP -->|next| UNPACK["host-side unpack"]
    UNPACK --> DIG["digest core → { pkgJsonDigest, bundleDigest }"]
    DIG --> CP["docker cp extracted tree →<br/>/base/extension-overrides/{prefix}.name-version/"]
    CP --> LOOP
    LOOP -->|done| MAN["return Manifest (what was installed)"]

    note["Why wipe BOTH: start.sh re-links an override only if strictly-newer<br/>semver. Equal/lower pre-release version would never re-link<br/>unless the runtime symlink is also cleared."]
    WIPE2 -.- note

    classDef n fill:#fffbe6,stroke:#d9a441,color:#333,font-size:11px;
    class note n;
```

**Recycled from #7718:** the unpack-into-`{prefix}.<name>-<version>/` layout, the runtime
symlink clearing, the `execFileSync` arg-array idiom.
**Redesigned:** wipe becomes **unconditional-by-publisher-glob** (was per-id `rm -rf`);
unpack moves **host-side**; swap now **emits the manifest** using the shared digest core.

---

## 7. Brick #3 — Lifecycle, and Brick #4 — Auth & Seed

### 7.1 Lifecycle (package owns docker)

```
pull(imageRef): void
run(spec): ContainerHandle          // spec: { imageRef, publishedPort, bootEnv, mounts, readiness }
restart(handle): ContainerHandle    // re-scan overrides + re-run boot auth (single lever)
teardown(handle): void
```

- **Typed `ContainerHandle`** (§3.2) — returned by `run`, accepted by every verb. Not a bare
  name string: the URL and boot env are facts downstream bricks must not re-derive.
- **Readiness folded into `run` and `restart`** — they return only once the workbench URL
  answers a health poll (params: timeout, interval, as options). You cannot obtain an
  unhealthy handle. Replaces #7718's two near-identical curl-poll loops.
- **`restart` is a single generic verb**, documented as "re-scans `/base/extension-overrides`
  (applies the swap) **and** re-runs `sfdx-org-auth.sh` (fresh org login)." These are
  physically one `docker restart`; splitting them would be a fiction the image doesn't
  support (ADR 0022 rejects reload-window for exactly this reason).
- **The fixture bind-mount is a `run` param** (mount happens at `docker run`), not a seed
  concern. Mount target `/home/codebuilder/fixture-project` (**not** the `SFDX_COBU_*` path —
  that collides with the first-boot generate, ADR 0022).

Container states — readiness is a self-transition inside `run`/`restart`, so a handle only
ever escapes into a `Healthy` state:

```mermaid
stateDiagram-v2
    [*] --> Pulled: pull(imageRef)
    Pulled --> Booting: run(spec)
    Booting --> Healthy: workbench URL answers (poll inside run)
    Booting --> Failed: readiness timeout → docker logs + throw
    Healthy --> Seeded: seedWorkspace (coder.json + trust)
    Seeded --> Swapped: swap (wipe + install), still pre-restart
    Swapped --> Rebooting: restart(handle)
    Rebooting --> Healthy: re-scan overrides + re-run org auth, URL answers
    Rebooting --> Failed: readiness timeout
    Healthy --> Verified: verify passes
    Verified --> [*]: teardown
    Failed --> [*]: teardown (always, if: always())
```

### 7.2 Auth / BootEnv (generic-but-Salesforce, opt-in `sf`)

**Two bricks, so the `sf` dependency is opt-in:**

- **Core (in `run`):** `bootEnv` is a **typed** input with the image's fixed known keys —
  `{ accessToken, instanceUrl }` — plus an `extraEnv: Record<string,string>` escape hatch.
  `run` stays **`sf`-free and unit-testable**; it just injects env the image needs at boot.
- **Optional helper:** `resolveOrgBootEnv(alias): BootEnv` — `sf`-aware, encapsulates the
  **hard-won redaction lesson**: read the token from `sf org auth show-access-token --json`,
  **not** `sf org display --json` (which redacts `accessToken` on recent CLI versions and
  boots the container with a bogus token → start-time login fails). The consumer *may* use
  this to produce the env, or supply their own. This is where the redaction fix (from the
  current PR #7846 work) becomes reusable so the next team doesn't re-hit it.

### 7.3 Seed (one brick, post-boot)

```
seedWorkspace(handle: ContainerHandle, opts: { fixturePath }): void
```

Owns **both** post-boot `docker exec` writes as one concern ("make the container open the
right workspace in the right mode before specs run"):

1. write `~/.local/share/code-server/coder.json` → `{"query":{"folder":"/home/codebuilder/fixture-project"}}`, and
2. write the **workspace-trust** setting (`security.workspace.trust.enabled = false`) so the
   Salesforce extensions activate (an untrusted workspace opens Restricted, commands never
   register). The setting is workspace-agnostic, so it covers the mount.

Runs **after** workbench-ready and **before** the swap restart, so the host boots opening the
fixture (ADR 0022). The **mount** is a `run` param (§7.1); seed does only the exec writes.

**Recycled from #7718:** `codeBuilderSeedWorkspace.ts` logic (coder.json + trust write),
the mount-over-first-boot-generate decoupling.
**Redesigned:** folded into one brick taking a `ContainerHandle`.

---

## 8. Incremental Delivery Plan

Each milestone is independently useful and independently testable (§15).

| # | Milestone | Independently delivers | Depends on |
|---|---|---|---|
| M1 | **Digest core + Manifest schema** | The digest math + the persisted, validated contract object. Testable with fixtures, no docker. | — |
| M2 | **Verify** | Assert correctness (semver **+ content**) after *any* swap, even a manual one. Closes the read side of the false-green. | M1 |
| M3 | **Swap** | Clean-slate install of an explicit list + manifest emission. Closes the write side (unconditional wipe). Composes with M2 into swap→verify. | M1 |
| M4 | **Lifecycle** | `pull/run/restart/teardown` + typed handle + folded readiness. Now the container can be stood up in-package. | — |
| M5 | **Auth + Seed** | `resolveOrgBootEnv` (redaction lesson) + `seedWorkspace`. Container boots authed and opens the fixture. | M4 |
| M6 | **Repo orchestrator + CI** | `test:container:local` + `codeBuilderE2E.yml` recomposed on the package; VSIX sourcing/dedup wired in. | M2–M5 |

M2 (verify) ships first per the Q3 decision. M1 is a prerequisite of M2, so it is the literal
first code, but verify is the first **externally meaningful** brick.

Milestone ordering and what unblocks what (M4 lifecycle runs in parallel with the
M1→M2→M3 content track; both converge at M6):

```mermaid
flowchart LR
    M1["M1 Digest core<br/>+ Manifest"] --> M2["M2 Verify<br/>(first shippable)"]
    M2 --> M3["M3 Swap"]
    M1 --> M3
    M4["M4 Lifecycle"] --> M5["M5 Auth + Seed"]
    M2 --> M6["M6 Orchestrator + CI"]
    M3 --> M6
    M4 --> M6
    M5 --> M6

    classDef ship fill:#fff3cd,stroke:#d9a441,color:#123,stroke-width:2px;
    class M2 ship;
```

---

## 9. Repo Integration Layer (thin, repo-specific)

Lives in the repo, **not** the package (§2 NG2/NG3):

- **VSIX sourcing** — `buildVsixes()` (from working tree, default; `vscode:package` + the
  modern/legacy build) and `downloadVsixes(runId)` (Build All artifact via `gh`, for
  reproducing a CI failure against shipping bytes). Produces the explicit path list.
- **VSIX selection/dedup** — the modern-vs-legacy (67.x) filter that produces one VSIX per
  extension. This is the saga that motivated "swap takes an explicit list" — it stays out of
  the package.
- **Orchestrator** — `scripts/codeBuilderLocalE2E.ts` recomposed as a thin sequence of package
  calls: `resolveOrgBootEnv → pull → run(bootEnv, mount) → seedWorkspace → swap → restart →
  verify → run specs → teardown`. This *is* also the real-docker integration test (§15).
- **CI workflow** — `codeBuilderE2E.yml` recomposed on the package; stays `workflow_call` /
  `workflow_dispatch` until reliably green, then slots into `e2e.yml`'s fan-out (already
  threads the build runId). The redaction fix already landed here (PR #7846) migrates into
  `resolveOrgBootEnv`.
- **Wiring constants** — publisher prefix (`salesforce`), image ref, `MINIMAL_ORG_ALIAS`,
  fixture path.

---

## 10. CI Integration & Scheduling (when / where to run)

### 10.1 Cadence decision — nightly + release, **not** per-PR

The Code Builder suite is **deliberately not run on every PR.** One pass pulls a multi-GB
image, creates a scratch org, boots a container, swaps + restarts, and drives a browser — far
heavier and slower than a unit test, and its value (catch CB-runtime-specific breakage against
the shipping bytes) is a *pre-release* signal, not a per-commit one. It runs exactly where the
other e2e suites already run:

| Trigger | Runs CB e2e? | Why |
|---|---|---|
| PR / push to a branch | **No** | Too heavy; CB breakage is not per-commit. Desktop unit + lint gate PRs. |
| **Nightly Build Develop** | **Yes** | Catch drift against a rolling `:latest` CB image + latest develop bytes, daily. |
| **Test, Build, and Release** | **Yes** | Gate the release — the VSIX about to ship is exercised on the real image. |
| **Beta Release branch** | **Yes** | Same gate for the beta channel. |
| `workflow_dispatch` | **Yes (manual)** | On-demand repro / debugging a specific `runId`. |

This is the *same* trigger set the existing `e2e.yml` fan-out already uses — so "run it when
we run the other e2e tests" means literally **adding CB as a leaf of `e2e.yml`**.

### 10.2 Where it wires up — a leaf of `e2e.yml`

`e2e.yml` is the hub: it triggers on `workflow_run` completion of *Nightly Build Develop*,
*Test, Build, and Release*, and *Create and Test Beta Release Branch*, and calls each suite as
a `workflow_call` leaf, threading the build **`runId`** (the run that produced the VSIXes).
`codeBuilderE2E.yml` is **already `workflow_call`-shaped** (takes `runId`, `artifactName`,
`image_tag`); wiring is one job block mirroring the existing leaves:

```yaml
# add to e2e.yml jobs:
  playwright-code-builder:
    if: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' || github.event_name != 'workflow_run' }}
    uses: ./.github/workflows/codeBuilderE2E.yml
    secrets: inherit
    with:
      runId: ${{ inputs.runId || github.event.workflow_run.id }}
```

```mermaid
flowchart TD
    NB["Nightly Build Develop"] -->|workflow_run: completed| E2E
    TBR["Test, Build, and Release"] -->|workflow_run: completed| E2E
    BETA["Beta Release Branch"] -->|workflow_run: completed| E2E
    WD["workflow_dispatch (manual, runId)"] --> E2E
    PR["PR / branch push"] -.->|NOT wired| E2E

    E2E["e2e.yml (fan-out hub)<br/>threads build runId"]
    E2E --> D1["coreE2E (desktop 3-OS)"]
    E2E --> D2["apex / lwc / org / … desktop leaves"]
    E2E ==>|NEW leaf| CB["codeBuilderE2E.yml<br/>(Linux-only, container)"]

    classDef new fill:#fff3cd,stroke:#d9a441,color:#123,stroke-width:2px;
    classDef no fill:#fdecea,stroke:#d9534f,color:#123,stroke-dasharray:4 3;
    class CB new;
    class PR no;
```

### 10.3 How it runs — one Linux job, not a 3-OS matrix

Desktop leaves (e.g. `coreE2E.yml`) fan out across `[macos-latest, ubuntu-latest,
windows-latest]` because the Electron host differs per OS. **CB does not:** the code-server
runtime inside the Linux container is identical regardless of host OS, and containers are
Linux — so CB is a **single `ubuntu-latest` job** (as #7718 already declares). Testing it on 3
host OSes would burn 3× the minutes to exercise the exact same runtime.

### 10.4 Promotion & failure policy (decisions)

- **Promotion gate:** keep `codeBuilderE2E.yml` on `workflow_dispatch` / `workflow_call` only
  until it is **reliably green across ~2 weeks of nightlies**; *then* add the `e2e.yml` leaf
  above. Don't gate the release on a flaky new suite.
- **Advisory → blocking, everywhere (decision):** wire CB **advisory** (non-blocking:
  `continue-on-error` at the leaf / required=false status) on **both** nightly and release
  paths at first, so a CB-image hiccup or a rolling-`:latest` shift can't block a release —
  or a nightly — while confidence builds. Once the suite proves stable, flip it to
  **blocking everywhere** (nightly *and* release) in one step. We deliberately do **not**
  split the policy by trigger: same suite, same bar, promoted together.
- **Avoiding advisory-rot:** the known risk of an advisory check is that it goes red and
  nobody looks. We accept that risk without a dedicated notifier — **the team already
  monitors nightly CI runs**, so a red CB nightly is seen through the normal nightly-watching
  workflow. No Slack hook or auto-filed bug is added (§10.5).
- **Rolling `:latest` is intentional (C4):** the image tag is rolling on **every** trigger,
  including release — we want to test against **whatever CB is live**, not a pinned snapshot.
  A nightly/release red can therefore mean "CB image changed under us," not "our code broke";
  the provenance banner (§4.5 manifest) + fail-loud version gate distinguish the two. We do
  **not** pin or record the image digest: **artifacts are timestamped**, so a stale/for-a-
  different-image result is identifiable by its timestamp alone.

### 10.5 What we explicitly are NOT adding

To keep the surface honest, these were considered and **rejected** for this plan:

- **No per-trigger blocking split** (e.g. block nightly, advisory release) — one policy,
  promoted together (§10.4).
- **No image-digest pinning or recording** — rolling `:latest` everywhere; timestamps flag
  staleness (§10.4, 2a).
- **No dedicated failure notifier** (Slack / auto-bug) — nightly CI is already monitored
  (§10.4, 2b).
- **No 3-OS matrix** — one Linux job; the container runtime is host-OS-independent (§10.3).

---

## 11. Migrating the Desktop Spec Library to the Container

### 11.1 Goal & the gap

Today the monorepo has **34 `*.desktop.spec.ts`** specs across 8 packages (apex,
apex-debugger, apex-replay-debugger, lightning, lwc, metadata, org, org-browser), run on the
Windows/Linux/macOS desktop matrix. The container path has **2** specs (core: `configList`,
`seededWorkspace`, from #7718 — a proof of concept, hence the core-only
`test:container -w salesforcedx-vscode-core` line in today's `codeBuilderE2E.yml`).

**Goal — parity, strictly additive:**

- **Parity:** every desktop spec gets a **container twin**, *except* specs that are
  genuinely desktop-only (§11.3). "Done" = the coverage ledger (§11.5) has **no un-triaged
  rows** — every desktop spec is either ported or excluded-with-a-reason.
- **Strictly additive:** the desktop suite is **unchanged** — it stays the cross-OS baseline
  (its unique value is Windows/macOS **Electron** behavior the container cannot exercise).
  Container specs are **copies added on top**, never a *move*. We never thin desktop because
  a behavior is now covered on CB.

```mermaid
flowchart LR
    subgraph NOW["Today"]
        DSK["34 desktop specs<br/>win / linux / osx matrix"]
        CON0["2 container specs<br/>(core only — #7718 POC)"]
    end
    subgraph GOAL["Target"]
        DSK2["desktop specs<br/>(UNCHANGED, still 3-OS baseline)"]
        CON1["container twins<br/>parity: one per non-excluded desktop spec"]
    end
    DSK -->|unchanged| DSK2
    DSK ==>|"copy (additive) + triage"| CON1
    CON0 --> CON1
```

### 11.2 What makes this cheap — already-decoupled page objects

The migration is viable **because ADR 0022 kept the `playwright-vscode-ext` page
objects/helpers on a plain Playwright `Page`** (no `_electron` coupling). The container
fixture (`createContainerTest`) and the desktop fixture drive the *same* page objects — so a
spec's **body** (the interactions + assertions) is largely target-agnostic; only **fixture
setup** and **environment assumptions** differ. Keeping helpers Electron-free is a hard
constraint the migration must preserve (a single `_electron` import in a shared helper breaks
the container path).

### 11.3 Triage — three buckets, and the load-bearing exclusion list

The container runs the **full installed extension set** (no `--disable-extensions`
isolation) **outside an MDE**, in a browser-served code-server. Under the parity goal, every
desktop spec lands in exactly one bucket:

| Bucket | Examples | Action |
|---|---|---|
| **Ports cleanly** | palette commands, editor/LSP interactions, deploy/retrieve against an org, test-runner surfaces | Copy → `*.container.spec.ts`; adjust fixture + workspace seeding only. |
| **Ports with changes** | specs needing metadata (use the mounted fixture project vs. desktop's create-mid-spec), specs asserting notifications (prefer on-disk artifacts) | Port + adapt the environment assumption. |
| **Excluded (desktop-only)** | multi-window / `_electron` APIs, OS-native file dialogs, system-clipboard flows, `--disable-extensions` single-extension isolation, OS-path assertions | **No container twin** — record the reason in the ledger. |

Because the target is **parity**, the **exclusion list is load-bearing**: it is the
*documented boundary* of what desktop proves that the container deliberately cannot. A spec
without a twin is only acceptable if it has an exclusion reason. That keeps parity honest —
"no un-triaged rows" — instead of aspirational.

**Cross-package interaction is a first-class goal, not a side effect.** Because the container
runs the **full** extension set in one workspace, the union of all packages' container specs
running together exercises **cross-package/cross-extension interactions** — activation order,
shared-command collisions, one extension's contribution affecting another — that neither the
desktop `--disable-extensions` isolation nor per-package test runs can catch. This is unique
coverage the container provides *by construction* (§11.5 runs them all in one boot to realize
it), and is an explicit reason the parity target is worth its cost (ADR 0022 consequence:
cross-extension interference is in scope).

### 11.4 Authoring model — per-spec choice (decision)

**The authoring model is decided per spec during triage, not globally.** Two shapes, chosen
by whether the spec body is genuinely target-agnostic:

- **Shared body, target-selected fixture** — *preferred when the body ports cleanly.* Factor
  the spec body into a shared function; a thin `*.desktop.spec.ts` and `*.container.spec.ts`
  each invoke it with their own fixture. One source of truth for behavior; target differences
  live in the fixture/capability layer. Mirrors the existing web/desktop split
  (`createWebConfig` / `createDesktopTest`).
- **Duplicate spec** — *used when the body genuinely diverges* (e.g. metadata created
  mid-spec on desktop vs. the mounted fixture on container, or a materially different
  assertion style). A standalone `*.container.spec.ts`, accepting the two-files-to-sync cost.

**Rejected: one runtime-branched file** (`if (target === 'container')` through the body) — it
tangles two environments' assumptions in one place. Critically, forcing a *shared body* onto
a spec whose steps truly diverge collapses back into this rejected shape wearing the shared
body's clothes — which is exactly why the choice is **per-spec**: use the shared body only
where it stays branch-free; otherwise duplicate. The fixture/capability layer (workspace
shape, org presence, "skip on container") absorbs *incidental* differences; *structural*
divergence is a signal to duplicate, not to branch.

### 11.5 Rollout — parallel with the bricks, one boot, parity-tracked

- **Author in parallel with M1–M6, against the #7718 pipeline (decision).** Spec authoring is
  **not** blocked on the package refactor. The #7718 pipeline already stands up a working
  swapped container today, and a spec doesn't care *which* orchestrator swapped/verified the
  extensions — it just needs a running, swapped container. So container twins are written now,
  against #7718, and **re-pointed at the package orchestrator when M6 lands** (a config/runner
  change, not a spec rewrite). Bonus: by the time M6 arrives, a real spec corpus exists to
  validate it against.
- **Order:** **core first** (already has 2), then highest-value packages (apex, org,
  metadata), then the rest. Each package's migration is its own follow-up story under the epic.
- **One container job, all packages, single boot (decision).** The final `codeBuilderE2E.yml`
  runs the **union of every package's container specs against a single booted image**, in
  sequence — **not** a per-package fan-out (which would pay 8× image pull + boot for no
  isolation benefit, since the container runs the full extension set regardless). Single-boot
  is also what *realizes* the cross-package-interaction coverage (§11.3): all extensions live
  in one workspace at once. The core-only `-w salesforcedx-vscode-core` line is a #7718 POC
  artifact and is replaced by an all-packages container run.
- **Parity ledger.** Track every desktop spec → container status (`ported` / `adapted` /
  `excluded: <reason>`). "Done" = no un-triaged rows. The ledger is the authoritative answer
  to "what's covered on CB," and its exclusion rows are the §11.3 load-bearing boundary.

> **Scope note:** this section is roadmap-level. Per-spec triage (which of the 34 land in
> which bucket), the shared-body refactors, and the all-packages CI wiring are **follow-up
> implementation stories** under the epic — distinct from the framework-package bricks
> (§5–§7). Authoring starts **now** against #7718 (above); only the final re-point and the
> all-packages CI job depend on M6.

---

## 12. Spec Migration Playbook (desktop → container, mechanics)

Where §11 is the *policy* (parity, additive, per-spec, one boot), this section is the
*mechanics*: exactly what changes when you turn a `*.desktop.spec.ts` into a
`*.container.spec.ts`, grounded in the two specs #7718 already shipped
(`configList.container.spec.ts`, `seededWorkspace.container.spec.ts`) and the shared
`playwright-vscode-ext` factories.

### 12.1 The one-line insight

**The spec body barely changes; the fixture and the environment setup do.** Both targets
drive the *same* plain-`Page` page objects (ADR 0022), and the workbench-ready helper already
self-branches — `waitForVSCodeWorkbench(page)` takes its **web** path (navigate to `/`, wait
for `.monaco-workbench`) when `VSCODE_DESKTOP` is unset, which is exactly the container case
(`createContainerTest` deliberately does **not** set `VSCODE_DESKTOP`). So the interaction
verbs (`executeCommandWithCommandPalette`, `verifyCommandExists`, `waitForOutputChannelText`,
`openFileFromExplorerTree`, …) are **identical across targets**. What differs is three things,
covered below: the **fixture import**, the **org/workspace setup**, and a set of **environment
adjustments**.

### 12.2 The four concrete file-level changes

| # | Desktop | Container | Note |
|---|---|---|---|
| 1 | `import { <someDesktopTest> } from '../fixtures/desktopFixtures'` | `import { containerTest as test } from '../../fixtures/containerFixtures'` | `containerFixtures.ts` is a one-liner: `export const containerTest = createContainerTest()`. |
| 2 | in-spec org setup: `createMinimalOrg()` + `upsertScratchOrgAuthFieldsToSettings(page, …)` | **nothing** — the org is the container's CLI default, auth'd at boot from `SF_ACCESS_TOKEN`/`INSTANCE_URL` (§7.2) | This is the biggest simplification and the biggest semantic shift (§12.4). |
| 3 | workspace via `createDesktopTest({ orgAlias, additionalExtensionDirs, userSettings, disableOtherExtensions })` | workspace is the **bind-mounted fixture project** + full installed extension set; no per-spec extension list | `additionalExtensionDirs` / `disableOtherExtensions` have **no container analog** — everything is installed (§12.5). |
| 4 | file lives at `specs/<name>.desktop.spec.ts`, config `playwright.config.ts` | file lives at `specs/container/<name>.container.spec.ts`, config `playwright.config.container.ts` (`createContainerConfig({ testDir: './specs/container' })`) | Separate testDir keeps `test:container` from picking up desktop specs. |

### 12.3 Side-by-side (a palette-command spec — the "ports cleanly" case)

```mermaid
flowchart LR
    subgraph D["DESKTOP spec"]
        D1["import desktopFixtures test"]
        D2["createMinimalOrg()"]
        D3["upsertScratchOrgAuthFieldsToSettings"]
        D4["waitForVSCodeWorkbench<br/>(desktop: wait selector)"]
        D5["verifyCommandExists / execute<br/>+ assert output"]
        D1-->D2-->D3-->D4-->D5
    end
    subgraph C["CONTAINER twin"]
        C1["import containerFixtures test"]
        C4["waitForVSCodeWorkbench<br/>(web: goto / then wait)"]
        C4b["clearAllNotifications<br/>(boot toasts)"]
        C5["verifyCommandExists / execute<br/>+ assert output (SAME verbs)"]
        C1-->C4-->C4b-->C5
    end
    D2 -.->|"dropped: org is<br/>boot-auth'd default"| C1
    D5 ==>|"body reused verbatim"| C5
```

The shared step (`D5`→`C5`) is the spec's actual value and moves **unchanged**. The org-setup
steps (`D2`,`D3`) simply **disappear** on the container side.

### 12.4 The org model shift (read this before porting an org-dependent spec)

Desktop and container obtain "the org" differently, and it changes what a spec can assert:

- **Desktop:** the spec *creates/sets* the org — `createMinimalOrg()` then writes
  `.sfdx/config.json target-org` (via `orgAlias` or `upsertScratchOrgAuthFieldsToSettings`).
  The spec controls org identity and can assert a **specific** `target-org`.
- **Container:** the org is the **CLI global default**, logged in at container start from the
  injected token. There is **no workspace `.sfdx/config.json`**. So a container spec asserts
  org-*backed behavior* (a config table renders, a deploy succeeds), **not** a specific
  target-org value — exactly what `configList.container.spec.ts` does (it checks the config
  table *header*, noting in-comment that org comes from the container default, not a
  workspace config).

**Porting rule:** if a desktop assertion is "the default org is exactly X," it must become
"org-backed operation Y works" on the container, or the spec is an **adapt**, not a clean
port (§11.3 bucket 2).

### 12.5 Environment adjustments (the container-specific preamble)

Container specs share a small preamble the desktop ones don't need, all visible in the two
#7718 specs:

- **Clear boot noise:** `clearAllNotifications(page)` — the first container boot stacks
  telemetry / what's-new toasts that can cover the output toolbar. Desktop launches clean.
- **Longer first-shell-out budgets:** a cold container pays `sf` startup + telemetry init on
  the first CLI command, so output-channel waits use **30s**, not the 10s that fits an
  already-warm desktop CLI. Bump timeouts on the first shell-out per spec.
- **Full extension set is always present:** no `--disable-extensions`, no
  `additionalExtensionDirs`. A command from any package is available — but so is
  cross-extension noise; rely on the allow-listed `nonCriticalErrorPatterns` /
  `nonCriticalNetworkPatterns` and keep `validateNoCriticalErrors(test, …)` at the end.
- **Metadata comes from the mount, not mid-spec creation:** where a desktop spec calls
  `createApexClass` to get something to act on, the container opens the **fixture project**
  already mounted (`seededWorkspace` opens `PagedResult.cls` from the Explorer). Grow the
  fixture project (`test/playwright/fixtures/container-workspace/`) to cover what specs need.

### 12.6 Per-spec procedure (the checklist)

For each desktop spec being ported:

```mermaid
flowchart TD
    S["pick desktop spec"] --> T{"triage bucket?<br/>(§11.3)"}
    T -->|"excluded"| X["record exclusion reason<br/>in ledger — no twin"]
    T -->|"ports cleanly / adapts"| A{"body target-agnostic?<br/>(§11.4)"}
    A -->|"yes"| SB["shared body:<br/>extract fn, thin desktop + container wrappers"]
    A -->|"no (diverges)"| DUP["duplicate:<br/>standalone *.container.spec.ts"]
    SB --> CP["swap fixture import → containerTest"]
    DUP --> CP
    CP --> ORG["remove in-spec org create/set<br/>(§12.4); adapt org-identity asserts"]
    ORG --> ENV["add container preamble:<br/>clearAllNotifications + 30s first-shell-out (§12.5)"]
    ENV --> META["metadata needs → grow the mounted fixture project"]
    META --> RUN["run vs #7718 pipeline now (§11.5);<br/>re-point at M6 orchestrator later"]
    RUN --> LEDGER["mark ledger: ported / adapted"]
```

### 12.7 What must NOT drift (invariants the migration relies on)

- **Page objects stay Electron-free.** A single `_electron` import in a shared helper breaks
  the container path (ADR 0022). Any helper a ported spec needs must take a plain `Page`.
- **No `VSCODE_DESKTOP` in the container fixture.** Setting it would flip
  `waitForVSCodeWorkbench` to the desktop (no-navigate) branch and the page would never load
  the workbench. The container fixture's *not* setting it is load-bearing.
- **Container config keeps `workers: 1`, `fullyParallel: false`.** One shared container = one
  editor session; parallel workers would fight over the same workbench. (Desktop can run
  parallel; container cannot — `createContainerConfig` defaults enforce this.)
- **Don't reintroduce clipboard-based content setting.** The shared skill guidance (type /
  write-file / command) applies doubly in a browser-served editor.

### 12.8 Effort shape (what to expect)

The three #7718-proven categories, by effort:

| Category | Change vs desktop | Effort |
|---|---|---|
| Palette / command-visibility / LSP (no org identity) | fixture import + preamble only | **Low** — near-verbatim body. |
| Org-backed operation (deploy, config, test-run) | above + drop org-setup + adapt identity asserts (§12.4) | **Medium.** |
| Metadata-driven (open/edit/act on a class) | above + grow the mounted fixture project | **Medium** — one-time fixture growth, then cheap. |
| `_electron` / OS-dialog / clipboard / single-extension-isolation / OS-path | — | **Excluded** (§11.3), no twin. |

---

## 13. Reusability Guide (second Salesforce team)

A second team on the same CB image adopts the package by writing **only** the §9 thin layer,
parameterized to them:

1. `npm i @salesforce/code-builder-e2e`.
2. Provide **their** VSIX paths (their build/download — the package never builds).
3. Call `swap(handle, theirVsixPaths, { publisherPrefix: 'theirPublisher' })`.
4. Call `resolveOrgBootEnv(theirAlias)` (or supply their own `{ accessToken, instanceUrl }`).
5. Point `seedWorkspace` at **their** fixture project.
6. Bring their own Playwright specs (reusing `playwright-vscode-ext` page objects, which take
   a plain `Page` — ADR 0022 keeps them Electron-decoupled).

Everything image-specific (override dir layout, runtime-symlink wipe, restart-rescan,
coder.json, boot-env keys, digest reconciliation) is **inside the package**. No fork.

---

## 14. Migration from #7718

| #7718 asset | Fate |
|---|---|
| `codeBuilderVerifyExtensions.ts` | → **package Verify brick** (+ content digest, typed Manifest). |
| `codeBuilderSwapExtensions.ts` | → **package Swap brick** (wipe → unconditional-by-glob; unpack → host-side; emits Manifest). |
| `codeBuilderSeedWorkspace.ts` | → **package Seed brick** (takes a handle). |
| `codeBuilderLocalE2E.ts` | → **repo orchestrator** (thin composition; also the integration test). |
| Two curl-poll readiness loops | → **folded into `run`/`restart`**. |
| Hand-rolled provenance log block | → **persisted `manifest.json`**. |
| `sf org auth show-access-token` fix (PR #7846) | → **`resolveOrgBootEnv`**. |
| Per-id `rm -rf` wipe | **Deleted** — replaced by unconditional publisher-glob wipe. |
| Separate swap/verify with no shared code | **Redesigned** — one shared digest core (required for content reconciliation). |
| `playwright-vscode-ext` container fixtures | **Kept unchanged** (plain `Page`, Electron-decoupled). |

---

## 15. Testing Strategy (docker seam)

**Layered (both), per Q12:**

- **Injectable command-runner seam.** Every container-facing brick takes an injected "run a
  command" function; default = real `execFileSync` (arg arrays, no shell interpolation —
  #7718 idiom). **Unit tests assert the exact argv** each brick builds (e.g. swap issues
  `docker cp <host-tree> <name>:/base/extension-overrides/…`) plus the pure logic (digest
  math, manifest parse/serialize, strictness cases) — fast, hermetic, no docker.
- **Real-docker integration suite.** A small suite exercises the true image contract
  (override dirs, restart-rescan, coder.json path, boot-env login) against the real image —
  essentially the repo orchestrator itself. Catches image-contract drift the fake seam can't.
- **Seam shape (Q12 follow-up):** the runner is a **plain injected function parameter**, with
  an **Effect service/layer adapter available**. This keeps "reusability as a core value"
  honest — a team **not** on Effect can still use every brick — while this Effect-native repo
  wraps it as a layer. `Manifest`/`ContainerHandle` are Effect Schema regardless (validation
  at boundaries), which does not force Effect on the *runner*.

The two test layers and what each covers (fast/hermetic on the left, high-fidelity on the
right; the same brick code runs under both, differing only in which runner is injected):

```mermaid
flowchart LR
    subgraph UNIT["Unit layer (no docker, fast)"]
        FAKE{{"fake runner<br/>(records argv)"}}
        T1["digest math / strictness cases"]
        T2["manifest parse ↔ serialize"]
        T3["argv correctness<br/>(e.g. swap issues correct docker cp)"]
        FAKE --> T3
    end

    subgraph INTEG["Integration layer (real docker)"]
        REAL{{"real execFileSync runner"}}
        I1["swap → restart → verify vs real image"]
        I2["override dirs, restart-rescan, coder.json, boot login"]
        REAL --> I1
        REAL --> I2
    end

    BRICKS(["same brick code<br/>(swap / verify / lifecycle / seed)"])
    BRICKS --> FAKE
    BRICKS --> REAL
    INTEG -.->|"≈ the repo orchestrator itself"| ORCH["test:container:local"]

    classDef unit fill:#eef6ff,stroke:#4a90d9,color:#123;
    classDef integ fill:#f3fbef,stroke:#5aa457,color:#123;
    class FAKE,T1,T2,T3 unit;
    class REAL,I1,I2 integ;
```

---

## 16. Risks & Open Questions

- **R1 — Digest brittleness.** `main`-file hashing assumes a stable, resolvable single entry.
  Multi-file bundles or a build that splits `main` would need the resolver extended. Mitigated
  by strict-on-unresolvable (fails loud, never false-green).
- **R2 — Image-contract drift.** Override-dir path, runtime-symlink location, `start.sh`
  relink rule, coder.json path are all CB-owned (ADR 0022, C3). The unconditional wipe removes
  the semver-precedence dependency, and verify fails loud on layout change — but a path move
  still breaks us. Integration suite (§15) is the early-warning.
- **R3 — Copy-out performance.** Verify copies every override dir out to hash on host. For a
  large extension set this is slower than in-container hashing; accepted for portability (Q5).
  Revisit only if it dominates run time.
- **R4 — `docker cp` of extracted trees vs. permissions/ownership.** Confirm cp'd trees land
  with ownership the host re-scan accepts (the `chown codebuilder:codebuilder` concern seen in
  the trust-write step may extend to swapped dirs). Validate in M3 integration.
- **R5 — Package boundary creep.** Pressure to pull VSIX sourcing/dedup into the package
  (NG2/NG3) will recur. Hold the line: the explicit-list contract is what keeps the package
  generic.
- **R6 — Parity maintenance cost.** Parity (§11.1) means the container spec set grows with the
  desktop set *forever* — a new desktop spec now implies a triage decision (twin or
  exclusion). Mitigated by the ledger (a missing twin is visible), but it is ongoing cost, not
  one-time. A CI check that flags a new `*.desktop.spec.ts` with no ledger row would keep it
  from silently drifting. *(OQ — worth building?)*
- **R7 — Cross-package flakiness in one boot.** Running all packages' specs in a single booted
  container (§11.5) is where cross-package coverage comes from — but it also means one
  extension's misbehavior (activation hang, error toast) can destabilize *another* package's
  specs, and serial execution makes the job long. Accepted as the cost of the interaction
  coverage; mitigate with per-spec isolation hygiene (no shared mutable workspace state) and
  the allow-listed non-critical-noise patterns (ADR 0022).
- **R8 — Advisory-rot during the un-proven window.** Policy (b) runs CB advisory until proven
  (§10.4). If the team's nightly monitoring lapses, a red CB can sit unnoticed and the
  eventual flip-to-blocking surfaces a backlog. Accepted per Q2b (no dedicated notifier);
  revisit if the un-proven window drags.
- **OQ1 — Package location & publish.** Internal monorepo package vs. independently published
  to npm. First consumer is in-repo; publishing is only needed when a real second team arrives
  (NG5). Recommend **in-repo package now, publish-ready structure**, defer actual publish.
- **OQ2 — Manifest persistence path & format** — where the orchestrator writes `manifest.json`
  and whether CI uploads it as an artifact (recommended: yes, it's the provenance record).

---

## 17. Appendix

- **ADR 0022** — desktop-build-over-browser, runtime extension-swap, the false-green
  consequence, workspace-seeding-by-mount. This plan implements 0022's recommended-but-not-yet-
  adopted **unconditional-wipe-by-publisher-glob + content-check** direction.
- **Glossary:**
  - *Override dir* — `/base/extension-overrides/{prefix}.<name>-<version>/`, the extracted
    extension tree the image loads.
  - *Runtime symlink* — `/home/codebuilder/.local/share/code-server/extensions/{prefix}.*`,
    relinked by `start.sh` only on strictly-newer semver; cleared by the wipe.
  - *Handle* — typed `ContainerHandle` threading through every verb.
  - *Manifest* — typed name→version→digests contract; swap emits, verify consumes, persisted.
  - *Boot env* — `{ accessToken, instanceUrl, extraEnv }` the image consumes at start for org
    login.
  - *Digest core* — shared internal: entrypoint resolver + composite (`pkgJsonDigest` +
    `bundleDigest`).
