---
description: Local scratch org setup for E2E tests
---

# Local Setup

Prereq: authenticated Dev Hub (`sf org login web --set-default-dev-hub` or similar).

## Dreamhouse

- **Alias:** `orgBrowserDreamhouseTestOrg` (override: `DREAMHOUSE_ORG_ALIAS`)
- **Used by:** org-browser, metadata (org picker tests)
- **Script:** `./packages/salesforcedx-vscode-org-browser/scripts/create-e2e-scratch-org.sh` (from repo root)
- **Custom alias:** `DREAMHOUSE_ORG_ALIAS=myAlias ./packages/salesforcedx-vscode-org-browser/scripts/create-e2e-scratch-org.sh`
- **Run org-browser tests:** `DREAMHOUSE_ORG_ALIAS=myAlias npm run test:web -w salesforcedx-vscode-org-browser`
- Script clones dreamhouse-lwc, creates scratch org, deploys metadata, assigns permset. Matches `.github/workflows/orgBrowserE2E.yml`.

## Minimal

- **Alias:** `minimalTestOrg` (override: `MINIMAL_ORG_ALIAS`)
- **Used by:** services, core, apex-log, apex-replay-debugger, apex-testing, metadata
- **No script.** Tests call `createMinimalOrg()` — creates org on first run if missing. Or create manually:

```bash
mkdir -p /tmp/minimal-project/force-app
echo '{"packageDirectories":[{"path":"force-app","default":true}],"namespace":"","sfdcLoginUrl":"https://login.salesforce.com","sourceApiVersion":"64.0"}' > /tmp/minimal-project/sfdx-project.json
cd /tmp/minimal-project && sf org create scratch -d -w 10 -a minimalTestOrg --wait 30 --json
```

## Non-tracking

- **Alias:** `nonTrackingTestOrg` (override: `NON_TRACKING_ORG_ALIAS`)
- **Used by:** metadata (non-tracking UI tests)
- **No script.** Tests call `createNonTrackingOrg()` — creates org on first run if missing. Or create manually (same as minimal + `--no-track-source`):

```bash
mkdir -p /tmp/non-tracking-project/force-app
echo '{"packageDirectories":[{"path":"force-app","default":true}],"namespace":"","sfdcLoginUrl":"https://login.salesforce.com","sourceApiVersion":"64.0"}' > /tmp/non-tracking-project/sfdx-project.json
cd /tmp/non-tracking-project && sf org create scratch -d -w 10 -a nonTrackingTestOrg --wait 30 --no-track-source --json
```

**Note:** Non-tracking test skips on web locally — requires Dev Hub aliased as `hub`. Desktop and CI work.
