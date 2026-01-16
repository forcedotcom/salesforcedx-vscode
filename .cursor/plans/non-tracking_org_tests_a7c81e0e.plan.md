---
name: Non-Tracking Org Tests
overview: Add a non-tracking scratch org setup function and comprehensive tests to verify metadata commands work correctly on orgs without source tracking, plus tests asserting that tracking-specific UI elements are hidden.
todos:
  - id: create-non-tracking-org-setup
    content: Create nonTrackingScratchOrgSetup.ts with --no-track-source flag
    status: pending
  - id: export-non-tracking-org
    content: Export createNonTrackingOrg from playwright-vscode-ext index.ts
    status: pending
  - id: non-tracking-test-file
    content: Create nonTrackingOrg.headless.spec.ts with operations + UI assertions
    status: pending
  - id: update-ci-workflow
    content: Update metadataE2E.yml to create non-tracking org in CI
    status: pending
---

# Non-Tracking Org Test Implementation W-20583332

## Summary

Create a new scratch org setup with `--no-track-source` flag and add tests verifying:

1. Core metadata operations work on non-tracking orgs
2. Source tracking status bar is hidden
3. View changes commands are not visible in command palette

## Implementation

### 1. Create Non-Tracking Org Setup

Add [`packages/playwright-vscode-ext/src/orgs/nonTrackingScratchOrgSetup.ts`](packages/playwright-vscode-ext/src/orgs/nonTrackingScratchOrgSetup.ts):

- Copy structure from [`minimalScratchOrgSetup.ts`](packages/playwright-vscode-ext/src/orgs/minimalScratchOrgSetup.ts)
- Add `--no-track-source` flag to the `sf org create scratch` command
- Use alias `NON_TRACKING_ORG_ALIAS = 'nonTrackingTestOrg'`

Export from [`packages/playwright-vscode-ext/src/index.ts`](packages/playwright-vscode-ext/src/index.ts).

### 2. Add Non-Tracking Org Test File

Create [`packages/salesforcedx-vscode-metadata/test/playwright/specs/nonTrackingOrg.headless.spec.ts`](packages/salesforcedx-vscode-metadata/test/playwright/specs/nonTrackingOrg.headless.spec.ts):

**Test 1: Operations work on non-tracking org**

- Setup non-tracking org via `createNonTrackingOrg()`
- Create Apex class
- Deploy via "Deploy This Source to Org"
- Generate manifest from the class
- Retrieve via manifest
- Deploy via manifest
- Delete source from project and org

**Test 2: Status bar and view changes commands hidden**

- Setup non-tracking org
- Wait for extension activation
- Assert status bar item (button with `arrow-down.*arrow-up` pattern) is NOT visible
- Open command palette (F1) and search for view changes commands
- Assert "View All Changes" / "View Local Changes" / "View Remote Changes" do NOT appear

### 3. Update CI Workflow

Update [`.github/workflows/metadataE2E.yml`](.github/workflows/metadataE2E.yml):

- Add step to create non-tracking scratch org with `--no-track-source`
- Add `NON_TRACKING_ORG_ALIAS` env var
- Add cleanup step for the new org

## Key Code References

Status bar visibility controlled by `tracksSource` in [`sourceTrackingStatusBar.ts`](packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts):

```28:32:packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts
      if (!statusBarItem || !orgInfo.tracksSource || !orgInfo.orgId) {
        statusBarItem?.hide();
        stopFileWatcherSubscription();
        return;
      }
```

View changes commands are always registered but rely on source tracking service which will fail gracefully on non-tracking orgs.
