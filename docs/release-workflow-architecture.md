# Release Workflow Architecture

> **Status:** `createReleaseBranch.yml` deprecated, scheduled for deletion after proven stability (W-23988524).

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RELEASE WORKFLOW                                │
│        Automated Tag-Based Releases + Emergency Response Capability     │
│              Single Branch • Zero Merge Conflicts • Same-Day Publishing │
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
Wednesday (Week N - 7 AM UTC) ───────────────────────────────┐
         │                                                   │
         ▼                                                   │
┌─────────────────────────────────────────────────────────────────┐
│  promote-nightly-to-prerelease.yml (AUTOMATED CRON)             │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ WHAT IT DOES:                                                │
│  │ ✓ Finds most recent CI-passing nightly (min-tag-age: 0 days) │
│  │ ✓ Creates marketplace-prerelease-* tracking tag              │
│  │   (marks which nightly to promote to stable next week)       │
│  │ ✓ Publishes that specific nightly to marketplace             │
│  │ ✓ Zero manual intervention                                   │
│  │                                                              │
│  │ WHY IT MATTERS:                                              │
│  │ • Real customers test pre-release in production              │
│  │ • Bug reports come in BEFORE stable publish                  │
│  │ • Can iterate/patch during 7-day customer validation window  │
│  └──────────────────────────────────────────────────────────────┤
└────────┬────────────────────────────────────────────────────────┘
         │                                                                │
         │ ════════════════════════════════════════════════════           │
         │ 7-DAY CUSTOMER VALIDATION PERIOD                               │
         │ Real users test prerelease in production before stable build   │
         │ ════════════════════════════════════════════════════           │
         │                                                                │
Next Wednesday (Week N+1 - 8 AM UTC)                                      │
         │                                                                │
         ▼                                                                │
┌─────────────────────────────────────────────────────────────────┐
│  build-release.yml (AUTOMATED CRON)                             │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ WHAT IT DOES:                                                │
│  │ 1. Finds marketplace-prerelease-* tracking tag               │
│  │    (previous Wednesday's promoted build that customer tested)│
│  │ 2. Extracts source commit SHA                                │
│  │ 3. Creates ephemeral release-staging/vX.Y.Z branch           │
│  │ 4. Bumps version in isolated branch                          │
│  │ 5. Builds VSIXs (15 min automated)                           │
│  │ 6. Creates GitHub pre-release with VSIXs + SHA256            │
│  │ 7. Branch automatically deleted after use                    │
│  │                                                              │
│  │ KEY IMPROVEMENTS:                                            │
│  │ ✓ ZERO merge conflicts (ephemeral branch, never merged)      │
│  │ ✓ No main branch needed (develop only)                       │
│  │ ✓ No long-lived release branches                             │
│  │ ✓ Builds exact commit customers already tested               │
│  │                                                              │
│  │ SECURITY HARDENING (7 vulnerabilities fixed):                │
│  │ ✓ Command injection prevention                               │
│  │ ✓ VSIX existence validation                                  │
│  │ ✓ Script integrity SHA256 verification                       │
│  │ ✓ Semver overflow protection (max 9999 per component)        │
│  │ ✓ Dependency resolution ordering fixed                       │
│  │ ✓ Release deletion timeout protection                        │
│  │ ✓ Enhanced error handling (JSON parsing, file validation)    │
│  └──────────────────────────────────────────────────────────────┤
└────────┬────────────────────────────────────────────────────────┘
         │                                                               │
         ▼                                                               │
┌──────────────────────────────────────────────────────────────────┐
│  Engineer Testing                                                │
│  • Download VSIXs from GitHub pre-release                        │
│  • Install and test                                              │
│  • Approve when ready                                            │
└────────┬─────────────────────────────────────────────────────────┘
         │                                                               │
         ▼                                                               │
┌──────────────────────────────────────────────────────────────────┐
│  publishVSCode.yml (Manual Trigger)                              │
│  • Extracts VSIXs from GitHub release                            │
│  • Publishes to Marketplace as STABLE                            │
│  • Triggers Web Console release                                  │
│  • Auto-closes shipped GitHub issues                             │
└──────────────────────────────────────────────────────────────────┘
                                                                         │
                                                                         │
═══════════════════════════════════════════════════════════════════════  │
EMERGENCY PRE-RELEASE PATH (5 minutes to marketplace) - NEW!             │
═══════════════════════════════════════════════════════════════════════  │
                                                                         │
   Critical Bug Discovered ────────────────────────────────────────┐     │
           │                                                       │      │
           ▼                                                       │      │
   ┌────────────────┐                                              │      │
   │ Hotfix Branch  │                                              │      │
   │ or Commit SHA  │                                              │      │
   └───────┬────────┘                                              │      │
           │                                                       │      │
           ▼                                                       │      │
   ┌──────────────────────────────────────────────────────┐        │      │
   │ Step 1: build-release.yml                            │        │      │
   │ -f publishAsPrerelease=true                          │        │      │
   │ -f startFromRef=hotfix/critical-bug                  │        │      │
   │ (~3 minutes)                                         │        │      │
   │ ┌────────────────────────────────────────────────────┤        │      │
   │ │ • Uses version from source's package.json (must    │        │      │
   │ │   be unique, not already published to marketplace) │        │      │
   │ │ • No automated version bump or branch creation     │        │      │
   │ │ • Builds VSIXs from exact ref                      │        │      │
   │ │ • Creates GitHub pre-release with nightly tag      │        │      │
   │ └────────────────────────────────────────────────────┤        │      │
   └───────┬──────────────────────────────────────────────┘        │      │
           │                                                       │      │
           ▼                                                       │      │
   ┌──────────────────────────────────────────────────────┐
   │ Step 2: promote-nightly-to-prerelease.yml            │
   │ -f releaseTag=v67.13.7-nightly.develop.20260821      │
   │ (~2 minutes)                                         │
   │ ┌────────────────────────────────────────────────────┤
   │ │ • Publishes to VS Code Marketplace                 │
   │ │ • Publishes to Open VSX                            │
   │ │ • Available to all users immediately               │
   │ └────────────────────────────────────────────────────┤
   └───────┬──────────────────────────────────────────────┘
           │                                                       │      │
           ▼                                                       │      │
   ┌──────────────────────────────────────────────────────┐
   │ LIVE ON MARKETPLACE (as pre-release)                 │
   │ Total time: ~5 minutes from hotfix → users           │
   └──────────────────────────────────────────────────────┘
                                                                   │      │
═══════════════════════════════════════════════════════════════════       │
EMERGENCY PATCH RELEASE PATH (Stable version hotfix) - NEW!               │
═══════════════════════════════════════════════════════════════════       │
                                                                          │
   v67.12.0 in marketplace has critical bug ──────────────────────┐       │
           │                                                      │       │
           ▼                                                      │       │
   ┌──────────────────────────────────────────────────────┐
   │ create-patch-release-branch.yml                      │
   │ -f baseVersion=67.12.0                               │
   │ • Creates release-base/v67.12.x from tag             │
   └───────┬──────────────────────────────────────────────┘
           │
           ▼
   ┌──────────────────────────────────────────────────────┐
   │ Push fixes to release-base/v67.12.x                  │
   └───────┬──────────────────────────────────────────────┘
           │
           ▼
   ┌──────────────────────────────────────────────────────┐
   │ build-and-release-patch-branch.yml                              │
   │ • Auto-increments (v67.12.0 → v67.12.1)              │
   │ • Builds VSIXs                                       │
   └───────┬──────────────────────────────────────────────┘
           │
           ▼
   ┌──────────────────────────────────────────────────────┐
   │ publishVSCode.yml → Marketplace                      │
   └──────────────────────────────────────────────────────┘
                                                                  │       │
═══════════════════════════════════════════════════════════════════════════

KEY IMPROVEMENTS SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ ZERO MERGE CONFLICTS: Ephemeral staging branch (never merged)
✓ SINGLE BRANCH: develop only (no main, no release/vX.Y.Z)
✓ CUSTOMER VALIDATION: 7-day prerelease testing period (Week N Wed → Week N+1 Wed)
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
WEEK N    Mon       Tue       Wed       Thu       Fri       Sat       Sun
                              │
                              ├─ promote-nightly-to-prerelease.yml (AUTOMATED 7 AM UTC)
                              │    • Finds most recent CI-passing nightly (min-tag-age: 0 days)
                              │    • Publishes to marketplace as PRE-RELEASE
                              │    • Creates marketplace-prerelease-* tracking tag
                              │    ✓ Real users test in production
                              │
                              │    [7 DAYS OF CUSTOMER TESTING]
                              │
WEEK N+1  Mon       Tue       Wed       Thu       Fri       Sat       Sun
                              │
                              ├─ build-release.yml (AUTOMATED 8 AM UTC)
                              │    • Finds previous Wed's marketplace-prerelease-* tag
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
Customer Validation Period: 7 DAYS (Week N Wed → Week N+1 Wed)
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
| **Customer Validation Period** | 0 (straight to stable) | 7 days (Week N Wed → Week N+1 Wed) | Real user testing |
| **Total Weekly Release Time** | 50-135 min | 30 min | 77-84% faster |
| **Emergency Response Time** | 7+ days (no path) | 5 minutes | 99.95% faster |
| **Patch Release Support** | ❌ No capability | ✓ v67.12.0 → v67.12.1 | New capability |
| **Security Vulnerabilities** | 7 unpatched | 0 (all fixed) | 100% resolved |
| **Annual Engineer Time Saved** | - | 43-109 hours/year | - |
| **Risk of User Impact** | High (all users immediately) | Lower (pre-release testing before stable build) | Validation window |
