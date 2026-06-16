# Telemetry IDs

We carry **three** user/machine identifiers in telemetry — `cliId`, `webUserId`, and the org's literal `userId` — because they answer different questions and target different destinations, and a span at emit time does not know which destination it will reach.

## Context

The three came about historically, not all at once:

- **`cliId`** — created once per machine when the CLI is installed; invariant unless the user deletes it. Read via `sf` ([cliTelemetry.ts](../../packages/salesforcedx-vscode-services/src/observability/cliTelemetry.ts)). It is the original cross-org "this is the same person/machine" identifier, but it only exists where the CLI is installed.
- **`webUserId`** — added so web (no CLI installed) could still track a user. A one-way `SHA-256(orgId-userId)` hash ([webUserId.ts:26-32](../../packages/salesforcedx-vscode-services/src/observability/webUserId.ts#L26-L32)), persisted to globalState, meant as the `cliId` successor: once set it tracks the user and is **not** reset on org switch ([defaultOrgRef.ts:21-27](../../packages/salesforcedx-vscode-services/src/core/defaultOrgRef.ts#L21-L27)). Compliance-safe because customer data cannot be decoded from the hash.
- **`userId`** — the literal `Id` from `SELECT Id FROM User` against the authenticated org ([connectionService.ts:172-193](../../packages/salesforcedx-vscode-services/src/core/connectionService.ts#L172-L193)). O11y accepts (and uses, with `orgId`) the real user-object ID for [M|D]AU; our prior telemetry did not, so this field is newer. It is per-org — it changes when the user switches orgs, which is exactly what cross-org trackers deliberately do not do.

## Decision

Spans annotate **all available** identifiers; each exporter projects only what its destination wants ([spanTransformProcessor.ts:40-64](../../packages/salesforcedx-vscode-services/src/observability/spanTransformProcessor.ts#L40-L64)). A span cannot know in advance whether it will land in App Insights or O11y (see [ADR-0012](./0012-spans-only-observability.md)), so it must carry the superset:

- App Insights node/web exporters emit the literal SOQL `userId` plus `webUserId` ([applicationInsightsNodeExporter.ts:155-156](../../packages/salesforcedx-vscode-services/src/observability/applicationInsightsNodeExporter.ts#L155-L156)).
- The O11y exporter and the shared span-transform processor emit `userId = cliId` plus `webUserId` ([o11ySpanExporter.ts:86-87](../../packages/salesforcedx-vscode-services/src/observability/o11ySpanExporter.ts#L86-L87)).

## Consequences

The same `userId` attribute name carries different meanings depending on the path (SOQL user ID vs. `cliId`). Do not assume one definition. Removing any of the three breaks a distinct consumer: `cliId` (legacy cross-machine), `webUserId` (cross-org person, web-capable), `userId` (per-org O11y [M|D]AU).
