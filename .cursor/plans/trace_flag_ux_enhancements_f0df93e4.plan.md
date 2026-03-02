---
name: Trace flag UX enhancements
overview: 'Three enhancements to trace flag management: show UserType in user QuickPick, include org DebugLevels in JSON file, and add DebugLevel picker when creating trace flags for other users.'
todos:
  - id: user-type-quickpick
    content: Add UserType to SOSL query and display in user QuickPick description
    status: completed
  - id: debug-level-query
    content: Add getDebugLevels() method + schema to TraceFlagService
    status: completed
  - id: debug-levels-json
    content: Add debugLevels array to TraceFlagsConfigSchema and populate in ensureTraceFlagsFile
    status: completed
  - id: debug-level-picker
    content: Add DebugLevel QuickPick after user picker in createTraceFlagForUserCommand
    status: completed
  - id: ensure-trace-flag-param
    content: Add optional debugLevelId param to ensureTraceFlag to skip auto-create
    status: completed
  - id: verify
    content: Run compile, lint, test, bundle, knip, check:dupes
    status: completed
isProject: false
---

# Trace Flag UX Enhancements

## 1. Show UserType in User QuickPick

In `[traceFlagJsonSync.ts](packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagJsonSync.ts)`:

- Add `UserType` to the SOSL query (line 181): `RETURNING User(Id, FirstName, LastName, Username, UserType WHERE IsActive = true ...)`
- Add `UserType` to `UserRecord` type (line 138)
- Update `toUserRecords` (line 155) to extract `UserType`
- Update `toUserQuickPickItems` (line 145) to include UserType in `description`, e.g.: `"jsmith@acme.com  (Standard)"`

## 2. Add DebugLevel records to JSON file

**TraceFlagService** (`[traceFlagService.ts](packages/salesforcedx-vscode-services/src/core/traceFlagService.ts)`):

- Add a `getDebugLevels()` method that queries all DebugLevel records from the org via Tooling API:

```sql
SELECT Id, DeveloperName, MasterLabel, Language, ApexCode, ApexProfiling, Callout, Database, Nba, System, Validation, Visualforce, Wave, Workflow
FROM DebugLevel
```

- Add a schema for the DebugLevel record in `[traceFlagSchemas.ts](packages/salesforcedx-vscode-services/src/core/schemas/traceFlagSchemas.ts)` (Tooling shape + client-facing shape)
- Export from service

**TraceFlagsSchema** (`[traceFlagsSchema.ts](packages/salesforcedx-vscode-apex-log/src/schemas/traceFlagsSchema.ts)`):

- Add `debugLevels` field (array of DebugLevel objects) to `TraceFlagsConfigSchema` -- at the bottom, after `traceFlags`

**ensureTraceFlagsFile** (`[traceFlagJsonSync.ts](packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagJsonSync.ts)`):

- Call `traceFlagService.getDebugLevels()` alongside `getTraceFlags()`
- Include the result as `debugLevels` array in the encoded JSON

## 3. DebugLevel Picker After User Picker

In `[traceFlagJsonSync.ts](packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagJsonSync.ts)`:

- Add a `pickDebugLevel` function that shows a QuickPick of org DebugLevels (fetched via `traceFlagService.getDebugLevels()`). Display format: label = `MasterLabel`, description = summary of level settings
- In `createTraceFlagForUserCommand` (line 220), after `pickOrgUser`, call `pickDebugLevel`. If user cancels, return early.
- Modify `ensureTraceFlag` in TraceFlagService to accept an optional `debugLevelId` parameter. When provided, skip `getOrCreateDebugLevel()` and use the passed ID directly.
- Pass the chosen debugLevelId into `ensureTraceFlag`

**Messages** (`[i18n.ts](packages/salesforcedx-vscode-apex-log/src/messages/i18n.ts)`):

- Add `trace_flag_pick_debug_level` localization key

## Verification

- Compile, lint, test, bundle, knip, check:dupes per workspace rules
