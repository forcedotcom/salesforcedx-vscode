# Proposal: Additional Common Telemetry Attributes

## Requested Properties

| Property | Type | Source | Description |
|----------|------|--------|-------------|
| `orgEdition` | string | `AuthFields.organizationType` | Org edition, e.g. "Developer Edition", "Enterprise Edition" |
| `isProd` | boolean | Derived | Whether the org is a production org (not scratch, not sandbox) |

## Dependency: `@salesforce/core` Update

The `orgEdition` property requires a new field (`organizationType`) in `AuthFields`, added via `Org.Fields.ORGANIZATION_TYPE`. This field is being added to `@salesforce/core` in a companion change (see plan: `.claude/plans/i-have-a-request-swift-hoare.md`).

Until `@salesforce/core` is published with `organizationType` in `AuthFields`, the `orgEdition` attribute cannot be populated without type casts. **Recommendation**: wait for the dependency bump before implementing.

## Existing Data Relevant to Prod/Test Determination

Both telemetry pipelines already emit data from which prod/test can be determined:

### `salesforcedx-vscode-services` (Effect-based, span attributes)

| Existing Attribute | Values | Emitted By | Present in O11y? |
|--------------------|--------|------------|-----------------|
| `isScratch` | `"true"` / `"false"` / omitted | `spanTransformProcessor.ts` | Yes, via `convertAttributes(span.attributes)` |
| `isSandbox` | `"true"` / `"false"` / omitted | `spanTransformProcessor.ts` | Yes, via `convertAttributes(span.attributes)` |

Note: `orgShape` is **not** emitted in this pipeline. The O11y span exporter (`o11ySpanExporter.ts`) reads `orgId`, `devHubOrgId`, `cliId`, `webUserId` from DefaultOrgRef, then spreads all span attributes (which include `isScratch`/`isSandbox`) into event properties.

**Logic**: If `isScratch === "false" && isSandbox === "false"`, the org is production.

### `salesforcedx-utils-vscode` (class-based, event properties)

| Existing Attribute | Values | Emitted By | Present in O11y? |
|--------------------|--------|------------|-----------------|
| `orgShape` | `"Scratch"` / `"Sandbox"` / `"Production"` / `""` | `appInsights.ts` `getBaseProps()` | **Yes** (also in `o11yReporter.ts`) |

Both `appInsights.ts` and `o11yReporter.ts` read `orgShape` from `WorkspaceContextUtil.getInstance().orgShape` and include it as an event property.

**Logic**: `orgShape === "Production"` directly identifies prod orgs.

### Assessment

The information needed to determine prod vs. test **already exists in the telemetry data**. Adding an explicit `isProd` boolean is a convenience for downstream consumers that want a single field rather than negating `isScratch`/`isSandbox` or checking `orgShape`. This could be handled:

1. **At collection time** (add `isProd` as a derived attribute in the extension)
2. **At reporting/query time** (let dashboards derive it from existing fields)

If the reporting side can derive prod/test from the existing `orgShape` and `isScratch`/`isSandbox` attributes, the `isProd` change can be skipped entirely from the extension code.

## Changes Needed per Package

### Package: `salesforcedx-vscode-services`

| File | Change |
|------|--------|
| `src/core/schemas/defaultOrgInfo.ts` | Add `orgEdition: Schema.optional(Schema.String)` to schema |
| `src/core/connectionService.ts` | Read `organizationType` from `conn.getAuthInfoFields()`, store as `orgEdition` in DefaultOrgRef |
| `src/observability/spanTransformProcessor.ts` | Emit `orgEdition` span attribute from DefaultOrgRef |
| `src/observability/o11ySpanExporter.ts` | **No change needed** — `convertAttributes(span.attributes)` already spreads all span attributes (including `orgEdition` once added by the processor) into O11y event properties |

### Package: `salesforcedx-utils-vscode`

| File | Change |
|------|--------|
| `src/context/workspaceContextUtil.ts` | Add `_orgEdition` field + getter/setter; populate from `connection.getAuthInfoFields().organizationType` in `handleCliConfigChange()` |
| `src/telemetry/reporters/appInsights.ts` | Add `orgEdition` to `getBaseProps()` |
| `src/telemetry/reporters/o11yReporter.ts` | Add `orgEdition` in `sendTelemetryEvent()` and `sendExceptionEvent()` |

### Package: `salesforcedx-vscode-core`

No changes needed for `orgEdition` (populated from auth fields in the other two packages).

### If `isProd` is also added (optional)

| Package | File | Change |
|---------|------|--------|
| `salesforcedx-utils-vscode` | `src/context/workspaceContextUtil.ts` | Add `_isProd` field + getter/setter |
| `salesforcedx-vscode-core` | `src/context/workspaceContext.ts` | Set `isProd = orgShape === 'Production'` in `handleOrgShapeChange()` |
| `salesforcedx-utils-vscode` | `src/telemetry/reporters/appInsights.ts` | Include `isProd` in `getBaseProps()` |
| `salesforcedx-utils-vscode` | `src/telemetry/reporters/o11yReporter.ts` | Include `isProd` in event properties (reads from `WorkspaceContextUtil` directly) |
| `salesforcedx-vscode-services` | `src/core/schemas/defaultOrgInfo.ts` | Add `orgShape: Schema.optional(Schema.String)` |
| `salesforcedx-vscode-services` | `src/core/connectionService.ts` | Derive `orgShape` from `isScratch`/`isSandbox` |
| `salesforcedx-vscode-services` | `src/observability/spanTransformProcessor.ts` | Emit `orgShape` span attribute |
| `salesforcedx-vscode-services` | `src/observability/o11ySpanExporter.ts` | **No change needed** — flows through via `convertAttributes(span.attributes)` |

## Open Question

> Should `isProd` / `orgShape` (in services) be added at collection time, or can the reporting side derive prod/test from the `isScratch`, `isSandbox`, and `orgShape` attributes that are already emitted?
