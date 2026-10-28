---
name: patch-release
description: Run emergency patch releases for critical hotfixes. Use when user explicitly requests patch release workflow.
review: never
---

# Patch Release

Emergency hotfixes only; not the weekly `/release` ceremony.

Canonical procedure: [Patch Release Workflow](../../../docs/release-testing-guide.md#patch-release-workflow).
Read before proposing or running mutating commands. It covers stable patches,
emergency prereleases, and later stable candidates from patched sources.

## Required Decisions

1. Inspect both registries, GitHub releases/tags, and pending publication runs.
2. Show exact released source tags/SHAs, reviewed fix commits, unused target
   versions, changelog scope, and commands. Get explicit confirmation before
   builds, publication, cancellation, or approval.
3. Follow the matching canonical branch:
   - [Stable patch](../../../docs/release-testing-guide.md#build-a-stable-patch):
     exact stable release tag, not its original nightly; `releaseBranch` input.
   - [Emergency prerelease](../../../docs/release-testing-guide.md#emergency-pre-release-workflow):
     exact published prerelease source; commit package/lockfile version changes
     using `node scripts/update-release-versions.js <version>` before building.
     Emergency `releaseVersion` names the tag only, not the VSIX version.
   - [Later stable candidate](../../../docs/release-testing-guide.md#later-stable-candidate-from-a-patched-prerelease):
     separate decision/build; explicit patched `startFromRef`, unused
     `releaseVersion`, complete original release changes plus fix in changelog.
     Hotfix promotion does not make stable auto-detection select that source.
4. Install/test each checkout; QA the exact new artifacts in the affected
   runtime. Record evidence; never infer passing tests.
5. Follow the channel-specific publication procedure:
   - Stable: [current hotfix workaround](../../../docs/release-testing-guide.md#publish-a-stable-hotfix).
     After QA, first mark the stable-packaged release `isPrerelease=false`.
     Leave automatic release-event runs unapproved (they skip hotfix tests);
     cancel only after confirmation. Dispatch both publishers from `develop`
     with `isHotfix=true`; approve only those runs and require both gates to pass.
   - Prerelease: promote the exact hotfix tag with `isHotfix=true`; promotion
     tests the source commit and publishes both registries. Keep it prerelease;
     `Tested & Approved` applies only to stable-packaged candidates.
6. Verify live versions/channels in both registries. Merge functional fixes to
   `develop` separately through a PR; exclude release-only version/tooling commits.

Existing candidates count as used versions, even if never published. Recovery
uses a new version, never deleting/recreating releases, retagging, or replacing
assets. An existing candidate's pending publications need a separate decision;
2 immediate channel hotfixes do not authorize a third candidate build.
