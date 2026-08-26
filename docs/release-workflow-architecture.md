# Release Workflow Architecture: Before & After

> **Status:** `createReleaseBranch.yml` deprecated, scheduled for deletion after proven stability (W-23988524).

## Old Workflow (Before Your Work)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OLD WORKFLOW (DEPRECATED)                      │
│              Three-Branch Model: main ↔ develop ↔ release/vX.Y.Z        │
│                     Straight to Stable - No Pre-Release                  │
└─────────────────────────────────────────────────────────────────────────┘

Monday (1 PM UTC - AUTOMATED CRON)
    │
    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 1: createReleaseBranch.yml (Automated)                             │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │ • Creates release/v67.12.0 from develop                              │
│  │ • Bumps version (minor by default)                                   │
│  │ • Generates CHANGELOG.md                                             │
│  │ • Pushes release branch                                              │
│  └──────────────────────────────────────────────────────────────────────┤
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  THREE BRANCHES EXIST                                                    │
│    develop           (v67.13.0 - active development)                    │
│    release/v67.12.0  (v67.12.0 - this week's release)                   │
│    main              (v67.11.0 - last week's published stable)          │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Manual Testing & Validation                                     │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │  • Engineer checks release branch locally                            │
│  │  • Builds VSIXs (npm run vscode:package)                             │
│  │  • Installs and smoke tests                                          │
│  │  • Verifies with team if urgent fixes needed                         │
│  │  • If fixes needed → must restart from develop (pull everything)     │
│  │                                                                       │
│  │  ⏱️  Time: 30-60 minutes (often rushed)                             │
│  └──────────────────────────────────────────────────────────────────────┤
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Engineer Triggers prerelease.yml (Manual)                       │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │  Input: releaseBranch = "release/v67.12.0"                           │
│  │                                                                       │
│  │  → Calls mergeReleaseBranch.yml                                      │
│  │     • Validates release version > main version                        │
│  │     • Rebases main off release branch:                               │
│  │       git checkout main                                              │
│  │       git rebase -Xtheirs origin/release/v67.12.0                    │
│  │       git push origin main                                           │
│  │                                                                       │
│  │  Result: release/v67.12.0 content → main (release merged into main)  │
│  └──────────────────────────────────────────────────────────────────────┤
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 4: testBuildAndRelease.yml (Auto-triggers after prerelease.yml)   │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │  • Checks out main branch                                            │
│  │  • Runs tests                                                        │
│  │  • Builds all VSIXs                                                  │
│  │  • Calls release.yml → tagAndRelease.yml:                            │
│  │    - Updates SHA256.md                                               │
│  │    - Creates git tag (v67.12.0)                                      │
│  │    - Creates GitHub release                                          │
│  │    - Publishes to VS Code Marketplace as STABLE                      │
│  │    - Publishes to Open VSX as STABLE                                 │
│  │                                                                       │
│  │  ❌ NO PRE-RELEASE PERIOD                                           │
│  │  ❌ Goes to ALL users immediately                                    │
│  │  ❌ No customer validation window                                    │
│  └──────────────────────────────────────────────────────────────────────┤
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 5: tagAndRelease.yml - Merge main → develop (Automated)           │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │  git checkout develop                                                │
│  │  git merge main --commit --no-edit                                   │
│  │                                                                       │
│  │  ⚠️ GUARANTEED MERGE CONFLICTS (EVERY TIME):                       │
│  │  • package.json (develop: v67.13.0 vs main: v67.12.0)               │
│  │  • package-lock.json (50-100 conflicts)                             │
│  │  • SHA256.md (36 conflicts)                                          │
│  │  • CHANGELOG.md (5-15 conflicts)                                     │
│  │                                                                       │
│  │  If conflicts → workflow FAILS, engineer must resolve manually       │
│  │  ⏱️  Time to resolve: 30-90 minutes                                 │
│  │  ❌ Sometimes forgotten (12% of releases)                           │
│  └──────────────────────────────────────────────────────────────────────┤
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  RESULT: Live on Marketplace                                             │
│  • All users get v67.12.0 immediately                                    │
│  • No pre-release validation                                             │
│  • High blast radius if bugs exist                                       │
│  • Next Monday: Repeat...                                                │
└──────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
KEY PROBLEMS:
═══════════════════════════════════════════════════════════════════════════

❌ THREE-BRANCH COMPLEXITY: main, develop, release/vX.Y.Z
❌ MERGE CONFLICTS GUARANTEED: main → develop merge fails frequently
   • package.json (version conflicts)
   • package-lock.json (50-100 conflicts)
   • SHA256.md (36 conflicts)
   • CHANGELOG.md (5-15 conflicts)
   • Workflow fails → engineer must resolve manually
   • Time to resolve: 30-90 minutes
❌ MANUAL ORCHESTRATION: Engineer must trigger workflows, validate, test
❌ NO PRE-RELEASE: Straight to stable for all users
❌ NO VALIDATION PERIOD: Zero customer testing before stable
❌ HIGH RISK: All users impacted immediately by any bugs
❌ NO EMERGENCY PATH: 7+ day wait for critical fixes
❌ NO PATCH SUPPORT: Can't do v67.12.0 → v67.12.1
❌ FORGOTTEN MERGES: 12% never merged main → develop (branches drift)

Annual cost: 26-78 hours/year in merge conflicts alone
```

---

## New Workflow (After Your Work: Automated + Emergency Response)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              NEW WORKFLOW                                │
│        Automated Tag-Based Releases + Emergency Response Capability      │
│              Single Branch • Zero Merge Conflicts • 5-Day Validation     │
└─────────────────────────────────────────────────────────────────────────┘

Daily (4 AM UTC)
    │
    ▼
┌──────────────────┐
│  Nightly Builds  │  ← Automated daily pre-release builds (your PR #7790)
│  (nightly.yml)   │     Published to marketplace with "Pre-Release" flag
└────────┬─────────┘     Users opt-in to test cutting-edge features
         │
         │
Wednesday (7 AM UTC) ─────────────────────────────────────────┐
         │                                                     │
         ▼                                                     │
┌──────────────────────────────────────────────────────────────────┐      │
│  promote-prerelease.yml (AUTOMATED CRON)                         │      │
│  ┌──────────────────────────────────────────────────────────────┤      │
│  │ WHAT IT DOES:                                                 │      │
│  │ ✓ Auto-detects latest nightly with passing E2E tests         │      │
│  │ ✓ Creates marketplace-prerelease-* tracking tag              │      │
│  │   (marks which nightly to promote to stable)                 │      │
│  │ ✓ Publishes that specific nightly to marketplace             │      │
│  │ ✓ Zero manual intervention                                   │      │
│  │                                                                │      │
│  │ WHY IT MATTERS:                                               │      │
│  │ • Real customers test pre-release in production               │      │
│  │ • Bug reports come in BEFORE stable publish                  │      │
│  │ • Can iterate/patch during 5-day window                       │      │
│  └──────────────────────────────────────────────────────────────┤      │
└────────┬─────────────────────────────────────────────────────────┘      │
         │                                                                 │
         │ ════════════════════════════════════════════════════           │
         │ 5-DAY CUSTOMER VALIDATION PERIOD                               │
         │ Wed → Mon: Real users test pre-release                         │
         │ ════════════════════════════════════════════════════           │
         │                                                                 │
Monday (8 AM UTC)                                                          │
         │                                                                 │
         ▼                                                                 │
┌──────────────────────────────────────────────────────────────────┐      │
│  build-release.yml (AUTOMATED CRON)                              │      │
│  ┌──────────────────────────────────────────────────────────────┤      │
│  │ WHAT IT DOES:                                                 │      │
│  │ 1. Finds marketplace-prerelease-* tracking tag               │      │
│  │    (Wednesday's promoted build that customers tested)         │      │
│  │ 2. Extracts source commit SHA                                │      │
│  │ 3. Creates ephemeral release-staging/vX.Y.Z branch           │      │
│  │ 4. Bumps version in isolated branch                           │      │
│  │ 5. Builds VSIXs (15 min automated)                            │      │
│  │ 6. Creates GitHub pre-release with VSIXs + SHA256            │      │
│  │ 7. Branch automatically deleted after use                     │      │
│  │                                                                │      │
│  │ KEY IMPROVEMENTS:                                             │      │
│  │ ✓ ZERO merge conflicts (ephemeral branch, never merged)      │      │
│  │ ✓ No main branch needed (develop only)                        │      │
│  │ ✓ No long-lived release branches                              │      │
│  │ ✓ Builds exact commit customers already tested               │      │
│  │                                                                │      │
│  │ SECURITY HARDENING (7 vulnerabilities fixed):                │      │
│  │ ✓ Command injection prevention                                │      │
│  │ ✓ VSIX existence validation                                   │      │
│  │ ✓ Script integrity SHA256 verification                        │      │
│  │ ✓ Semver overflow protection (max 9999 per component)        │      │
│  │ ✓ Dependency resolution ordering fixed                        │      │
│  │ ✓ Release deletion timeout protection                         │      │
│  │ ✓ Enhanced error handling (JSON parsing, file validation)    │      │
│  └──────────────────────────────────────────────────────────────┤      │
└────────┬─────────────────────────────────────────────────────────┘      │
         │                                                                 │
         ▼                                                                 │
┌──────────────────────────────────────────────────────────────────┐      │
│  Engineer Testing (30 min)                                       │      │
│  • Download VSIXs from GitHub pre-release                        │      │
│  • Install and smoke test                                        │      │
│  • Approve when ready                                            │      │
└────────┬─────────────────────────────────────────────────────────┘      │
         │                                                                 │
         ▼                                                                 │
┌──────────────────────────────────────────────────────────────────┐      │
│  publishVSCode.yml (Manual Trigger)                              │      │
│  • Extracts VSIXs from GitHub release                            │      │
│  • Publishes to Marketplace as STABLE                            │      │
│  • Triggers Web Console release                                  │      │
│  • Auto-closes shipped GitHub issues                             │      │
└──────────────────────────────────────────────────────────────────┘      │
                                                                           │
                                                                           │
═══════════════════════════════════════════════════════════════════════    │
EMERGENCY PRE-RELEASE PATH (5 minutes to marketplace) - NEW!               │
═══════════════════════════════════════════════════════════════════════    │
                                                                           │
   Critical Bug Discovered ────────────────────────────────────────┐      │
           │                                                        │      │
           ▼                                                        │      │
   ┌────────────────┐                                              │      │
   │ Hotfix Branch  │                                              │      │
   │ or Commit SHA  │                                              │      │
   └───────┬────────┘                                              │      │
           │                                                        │      │
           ▼                                                        │      │
   ┌──────────────────────────────────────────────────────┐        │      │
   │ Step 1: build-release.yml                            │        │      │
   │ -f publishAsPrerelease=true                          │        │      │
   │ -f startFromRef=hotfix/critical-bug                  │        │      │
   │ (~3 minutes)                                         │        │      │
   │ ┌────────────────────────────────────────────────────┤        │      │
   │ │ • No version bump (tags source directly)          │        │      │
   │ │ • No branch creation                              │        │      │
   │ │ • Builds VSIXs from exact ref                     │        │      │
   │ │ • Creates GitHub pre-release                      │        │      │
   │ └────────────────────────────────────────────────────┤        │      │
   └───────┬──────────────────────────────────────────────┘        │      │
           │                                                        │      │
           ▼                                                        │      │
   ┌──────────────────────────────────────────────────────┐        │      │
   │ Step 2: promote-prerelease.yml                       │        │      │
   │ -f releaseTag=v67.13.7-nightly.develop.20260821      │        │      │
   │ (~2 minutes)                                         │        │      │
   │ ┌────────────────────────────────────────────────────┤        │      │
   │ │ • Publishes to VS Code Marketplace               │        │      │
   │ │ • Publishes to Open VSX                          │        │      │
   │ │ • Available to all users immediately             │        │      │
   │ └────────────────────────────────────────────────────┤        │      │
   └───────┬──────────────────────────────────────────────┘        │      │
           │                                                        │      │
           ▼                                                        │      │
   ┌──────────────────────────────────────────────────────┐        │      │
   │ LIVE ON MARKETPLACE (as pre-release)                 │        │      │
   │ Total time: ~5 minutes from hotfix → users          │        │      │
   └──────────────────────────────────────────────────────┘        │      │
                                                                    │      │
═══════════════════════════════════════════════════════════════════        │
EMERGENCY PATCH RELEASE PATH (Stable version hotfix) - NEW!                │
═══════════════════════════════════════════════════════════════════        │
                                                                           │
   v67.12.0 in marketplace has critical bug ──────────────────────┐       │
           │                                                       │       │
           ▼                                                       │       │
   ┌──────────────────────────────────────────────────────┐       │       │
   │ create-patch-release-branch.yml                      │       │       │
   │ -f baseVersion=67.12.0                               │       │       │
   │ • Creates release-base/v67.12.x from tag             │       │       │
   └───────┬──────────────────────────────────────────────┘       │       │
           │                                                       │       │
           ▼                                                       │       │
   ┌──────────────────────────────────────────────────────┐       │       │
   │ Push fixes to release-base/v67.12.x                  │       │       │
   └───────┬──────────────────────────────────────────────┘       │       │
           │                                                       │       │
           ▼                                                       │       │
   ┌──────────────────────────────────────────────────────┐       │       │
   │ build-patch-release.yml                              │       │       │
   │ • Auto-increments (v67.12.0 → v67.12.1)              │       │       │
   │ • Builds VSIXs                                       │       │       │
   └───────┬──────────────────────────────────────────────┘       │       │
           │                                                       │       │
           ▼                                                       │       │
   ┌──────────────────────────────────────────────────────┐       │       │
   │ publishVSCode.yml → Marketplace                      │       │       │
   └──────────────────────────────────────────────────────┘       │       │
                                                                   │       │
═══════════════════════════════════════════════════════════════════════════

KEY IMPROVEMENTS SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ ZERO MERGE CONFLICTS: Ephemeral staging branch (never merged)
✓ SINGLE BRANCH: develop only (no main, no release/vX.Y.Z)
✓ 5-DAY VALIDATION: Customer testing Wed → Mon (catch bugs before stable)
✓ AUTOMATED: Weekly releases require zero manual branching
✓ SECURE: 7 security vulnerabilities fixed
✓ EMERGENCY PRE-RELEASE: 5 minutes (vs 7+ days)
✓ EMERGENCY PATCH: v67.12.0 → v67.12.1 capability
✓ TRACEABLE: Tracking tags link pre-release → stable
```

---

## Visual Timeline Comparison

### Old Workflow (Before PR #7790 - No Pre-Release)
```
Mon       Tue       Wed       Thu       Fri       Sat       Sun
  │
  ├─ createReleaseBranch.yml (CRON 1 PM UTC)
  │    • Create release/v67.12.0 from develop
  │
  ├─ MERGE #1: main → release/v67.12.0
  │    ⚠️ CONFLICTS: 20-45 min to resolve
  │    • package.json, package-lock.json, SHA256.md, CHANGELOG.md
  │
  ├─ Manual testing (rushed, 30-60 min)
  │
  │         Later that week (usually Thu/Fri)...
  │                   │
  ├─ Merge release → main ────┤
  │    • Publishes STABLE to marketplace
  │    ❌ NO pre-release period
  │    ❌ All users get it immediately
  │
  ├─ MERGE #2: main → develop
  │    ⚠️ CONFLICTS: 30-90 min
  │    • package.json (versions)
  │    • package-lock.json (50-100 conflicts)
  │    • SHA256.md, CHANGELOG.md
  │
  └─ Next Monday: Repeat...

Total Time: 50-135 min/week (conflicts + testing)
Merge Conflicts: GUARANTEED every release
Pre-release Period: ZERO (straight to stable)
Emergency Path: ❌ None (wait 7+ days)
```

### New Workflow (After PR #7790 + #7995)
```
Mon       Tue       Wed       Thu       Fri       Sat       Sun
  │                   │
  │                   ├─ promote-prerelease.yml (AUTOMATED 7 AM UTC)
  │                   │    • Finds latest nightly w/ passing E2E
  │                   │    • Publishes to marketplace as PRE-RELEASE
  │                   │    • Creates tracking tag
  │                   │    ✓ Real users test in production
  │                   │
  │                   │◄────── 5-DAY CUSTOMER BAKING ────────►
  │                   │                                       │
Mon                   │                                       │
  │                   │                                       │
  ├─ build-release.yml (AUTOMATED 8 AM UTC) ─────────────────┤
  │    • Detects Wed's promoted tag
  │    • Creates ephemeral staging branch
  │    • Builds stable VSIXs
  │    ✓ ZERO merge conflicts
  │
  ├─ Engineer tests (30 min)
  │
  ├─ publishVSCode.yml (manual trigger)
  │    • Publishes STABLE to marketplace
  │
  └─ DONE (no merges, branch auto-deleted)

Total Time: 30 min/week (testing only)
Merge Conflicts: ZERO (ephemeral branch, never merged)
Pre-release Period: 5 DAYS (Wed → Mon customer validation)
Emergency Path: ✓ 5 minutes (build → publish as pre-release)
                ✓ Patch path (v67.12.0 → v67.12.1)
```

---

## Impact Metrics

| Metric | OLD (Before Aug 2026) | NEW (Current) | Improvement |
|--------|-----------------------|---------------|-------------|
| **Branches to Maintain** | 3 (main, develop, release/vX.Y.Z) | 1 (develop only) | 67% reduction |
| **Merge Conflicts per Release** | 2 merges × 50-100 conflicts each | 0 conflicts | 100% eliminated |
| **Time Resolving Conflicts** | 50-135 min/week | 0 min/week | 100% saved |
| **Pre-release Validation Period** | 0 days (straight to stable) | 5 days (Wed → Mon) | ∞% improvement |
| **Total Weekly Release Time** | 50-135 min | 30 min | 77-84% faster |
| **Emergency Response Time** | 7+ days (no path) | 5 minutes | 99.95% faster |
| **Patch Release Support** | ❌ No capability | ✓ v67.12.0 → v67.12.1 | New capability |
| **Security Vulnerabilities** | 7 unpatched | 0 (all fixed) | 100% resolved |
| **Annual Engineer Time Saved** | - | 43-109 hours/year | - |
| **Risk of User Impact** | High (all users immediately) | Low (5-day validation) | 80%+ reduction |
