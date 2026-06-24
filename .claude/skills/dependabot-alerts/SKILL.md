---
name: dependabot-alerts
description: Triage GitHub Dependabot security alerts into one-point GUS work items that bump the outermost consumer. User-invoked only.
---

# Dependabot Alerts

Triage open Dependabot **security alerts** into GUS work items. Output is **work items only** — no branches, bumps, or PRs. The [auto-build-wi workflow](../../workflows/auto-build-wi.js) claims each WI and does the build/PR.

**User-invoked only.** Never auto-fire.

## Never

- **No `npm overrides`** in `package.json`. Ever.
- **No blind lockfile bumps.** Trace the dependency to its outermost consumer first.

## Input

- Bare invocation → list open alerts: `gh api repos/forcedotcom/salesforcedx-vscode/dependabot/alerts --jq '[.[] | select(.state=="open")]'`
- User-specified package / GHSA / CVE → act on that alert only.

(Repo is a monorepo, workspaces `packages/*`. npm 11.)

## Per alert: trace the thread

Find who pulls the vulnerable package in, working outward to a `package.json`.

1. `npm why <vuln-pkg>` (or `npm ls <vuln-pkg>`) from repo root → every path to a **direct dep declared in a `package.json`** (root or a `packages/*`).
2. For each path, the **outermost consumer** is the direct dep at the top of that path. One alert can have several.

## Per consumer: pick the fix

Try in order; **stop at the first that works**:

1. **Bump the consumer in `package.json`.** A newer version of the consumer resolves `<vuln-pkg>` to a patched version (consumer already shipped the fix). Edit the version in whichever `package.json` declares it. *Best — preferred.*
2. **`npm update <consumer>`.** Consumer's existing semver range already allows a patched `<vuln-pkg>`, but the lockfile is stale. No `package.json` change. *Second best.*
3. **Unfixable** — consumer's latest still pins the vulnerable version. **Skip this path silently. No WI.**

## Dependabot dedup screen

Before creating a WI for a bump, check for an existing Dependabot PR proposing the same bump (`gh pr list --author 'app/dependabot' --state open`):

| Dependabot PR state | Action |
| --- | --- |
| Green / mergeable | **Skip** — let Dependabot merge it. No WI. |
| CI failing | **Close** the Dependabot PR (`gh pr close`), then create the WI (manual AI loop is better than a broken Dependabot bump). |
| CI still running | **Wait** — don't create a WI, don't close. Re-check later. |
| None | Proceed to create the WI. |

## Create the work items

**One WI per consumer-bump**, not per alert. If one alert needs three consumers bumped → three WIs → three PRs. Isolation: each PR's CI/regression runs against exactly one change, so a failure points at one bump.

Each WI:

- **1 story point.**
- `[ai-auto]` at the **front of `Subject__c`** (e.g. `[ai-auto] bump <consumer> to <ver> for <GHSA> (<vuln-pkg>)`).
- Assigned to the runner (you).
- Epic: **IDEx - Mandates and Updates** `a3QEE0000023Fm92AE`. If that epic is closed (`Health__c` in Completed/Canceled), use the most recent open **trust** epic instead — query team epics, match by Name.

**`Details__c`** = the fix recipe so auto-build-wi can execute blind:

- GHSA/CVE id, vulnerable package + affected range.
- The fix: which `package.json`, which consumer, target version (case 1) **or** `npm update <consumer>` (case 2).
- **Verification:** the exact version that should land in `package-lock.json` after the build.
- When an alert is split across consumers: `1 of N for <GHSA>` (each PR stands alone; Dependabot closes the alert once all land).

Follow [gus-cli/SKILL.md](../gus-cli/SKILL.md) for create mechanics (fields, confirmation, temp-Subject + flags-dir flow) and runner identity. Show the draft and **wait for confirmation** before any `sf data create record`.

## Completion criterion

Every open alert is one of: a created WI (with a lockfile-version verification line), skipped as unfixable, skipped as a green Dependabot PR, or waiting on a running Dependabot PR. Report the disposition of each.
