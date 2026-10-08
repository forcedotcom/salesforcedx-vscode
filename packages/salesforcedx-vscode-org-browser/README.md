# Salesforce Org Browser

Browse metadata in an authenticated Salesforce org, inspect its contents, and retrieve components into the current Salesforce project.

## Requirements

- VS Code 1.90.0 or later
- An authenticated Salesforce org
- A selected default org
- Salesforce Extension Pack for Visual Studio Code, which installs the required Salesforce Services extension

A Salesforce DX project is typical when retrieving metadata, but it is not required to browse an org.

## Use Org Browser

1. Select the **Org Browser** icon in the Activity Bar.
2. Expand metadata types and components to inspect the default org's metadata.
3. Select a component or metadata type and use retrieve commands when you want to add it to a local project.

## Filter Metadata

Use **Filter by Type/Component** in the Org Browser toolbar to search metadata types and component names. When a filter is active, the toolbar icon changes to **Edit Filter (active)**.

| Input | Searches |
| --- | --- |
| `Broker` | Metadata type names and component names containing `Broker` |
| `Apex*` | Type and component names matching the wildcard expression |
| `ApexClass:` | Metadata type names matching `ApexClass` |
| `ApexClass:Broker` | Components containing `Broker` within matching metadata types |
| `:Broker` | Components containing `Broker` across all metadata types |
| `/Apex.*/` | Type and component names matching a regular expression |
| `ApexClass:/Broker.*/` | Components matching a regular expression within `ApexClass` |

Plain-text searches are case-insensitive substring searches. Use `*` for wildcard matching.

## Local And Org Visibility

The Org Browser toolbar also has **Show Local Types** and **Show Org Types** toggles. They control which metadata is eligible to appear before a text filter is applied.

| Show Local Types | Show Org Types | Visible results |
| --- | --- | --- |
| On | On | All available local and org metadata. |
| On | Off | Only metadata with a corresponding source file in the workspace. |
| Off | On | Only metadata known to exist in the active org, including components that also exist locally. |
| Off | Off | No results. This is an explicit "show nothing" state. |

The visibility toggles and the text filter combine as an intersection: a component must be visible under the selected local/org mode and match the text filter to appear. For example, with **Show Local Types** enabled and **Show Org Types** disabled, a component search returns only matching components that have local source files.

The toggles are stored per org ID with the text and regular-expression filters. Changing the default org restores that org's saved local/org visibility mode.

## Search Timing

Org Browser applies a filter after you stop typing for 300 ms. Pressing Enter closes the filter input and applies its current value immediately.

## Incomplete Search Expressions

Structured searches are not sent to the org until they are complete and valid. Examples that need correction include:

- `/Apex` because the regular expression is missing its closing `/`
- `ApexClass:/Broker` because the component regular expression is incomplete
- `ApexClass:` because a component-search clause is incomplete
- `ApexClass:/[/` because the regular expression is invalid

For these expressions, Org Browser shows an empty-tree message explaining that the expression must be completed or corrected before searching the org. Correct the expression and pause typing to resume search behavior.

## Search All Metadata Types

Org Browser initially searches metadata that is already loaded for the active org. When relevant metadata types have not been loaded, it shows a non-modal notification:

> Search all N metadata types in the org? This may take longer and make additional requests.

| Action | Result |
| --- | --- |
| **Search All Types** | Discovers metadata across the org and expands results as matching types become available. |
| **Use Loaded Results** | Searches currently loaded metadata only. Results can be incomplete until additional metadata is loaded. |
| Dismiss notification | Uses loaded results for the current search. |

The notification appears after a valid term remains unchanged for the debounce interval. It is not shown for incomplete or invalid structured expressions. If it disappears while editing, pause on a valid expression again to show a new notification. Org Browser prevents duplicate notifications while one is already active.

When Org Browser starts with a restored component filter, it waits for this choice before beginning the filtered tree projection. This prevents metadata loading from starting before you choose the search scope.

## Discovery Progress

While discovering all metadata types:

- The Org Browser tree uses its normal busy indicator during refreshes.
- The status bar shows progress, for example `Discovering org metadata 24/172`.
- Results refresh periodically as discovery progresses.
- A metadata type that cannot be listed is skipped and logged; it does not prevent results from other metadata types from appearing.

When Org Browser lazily loads metadata for the initial tree, an expanded node, or a regular tree refresh, the status bar uses the same `Discovering org metadata` text. It appears only when the request lasts longer than 300 ms, so cached results do not flash a status item. Concurrent requests are shown as `Discovering org metadata (N requests)`.

The lightweight request count is not a completion total. Full filter discovery can show `n/m` progress because it first enumerates the metadata types and nested branches it will acquire. Ordinary tree loading is demand-driven: expanding a node or applying a filter can reveal further folders and fields, so Org Browser reports active requests rather than an inaccurate completion percentage.

Discovery acquires every metadata branch that Org Browser supports for the active org, including nested folders and Custom Object fields. It does not change the active text filter or local/org visibility toggles. Each periodic tree refresh applies the current visibility mode and text filter to whatever metadata has been discovered so far.

This means the tree can grow, shrink, or remain empty while discovery continues:

| Current UI state | What to expect during discovery |
| --- | --- |
| A matching type or component has been discovered | It appears at the next periodic tree refresh. |
| No matching metadata has been discovered yet | The tree remains empty while the status bar continues to show discovery progress. |
| Local-only or org-only visibility is selected | Newly discovered metadata still has to satisfy that visibility mode before it appears. |
| The filter or visibility toggle changes | The tree immediately reapplies the new state; discovery continues for the active org. |
| A metadata type cannot be listed | That type may not contribute results, but discovery and results for other types continue. |

The discovery prompt is non-modal, so you can keep editing the filter or change visibility toggles while it is visible. The status item is removed and a final tree refresh occurs when discovery ends. A manual root refresh resets the completed-discovery marker for the active view, so a later component search can ask to discover again if inventory data is no longer available.

## Stored State

| Data | Scope |
| --- | --- |
| Show Local Types setting | Per org ID |
| Show Org Types setting | Per org ID |
| Filter text and regular-expression settings | Per org ID |
| Metadata inventories and catalog observations | Per org ID |

A new scratch org starts without a saved filter. Switching back to an earlier org restores that org's previous filter and can reuse persisted metadata inventories and catalog observations to warm the new session. Org Browser rebuilds its tree projections and refreshes metadata when required. Filters from one org are not applied to another org.

## Restoration Lifecycle

### When The Target Org Changes

When you change the default org while VS Code remains open, Org Browser:

- Restores the filter text, regular-expression settings, and local/org visibility mode saved for the newly active org.
- Clears the filter if there is no active org.
- Keeps in-memory catalog data for previously used orgs available during the current session.
- Refreshes the tree for the newly active org. The tree projection is recreated for that org; it is not transferred from the previously active org.

Metadata inventories and catalog observations already acquired for the newly active org can be reused from the current session. A type is fetched again only when the catalog needs fresh data or its cached data has been invalidated.

### When Org Browser Initializes

At extension activation, Org Browser waits until the default org has an org ID, then restores that org's filter state before displaying the tree. Existing workspaces with the earlier, workspace-wide filter settings are migrated once to the initial org's per-org filter state.

Catalog snapshots are loaded lazily when Org Browser or another catalog consumer first needs metadata for the active org. The snapshot can restore persisted type inventories and catalog observations, but Org Browser still recreates its tree projection and obtains root metadata types for the new session. It may make additional org requests when data is missing, stale, or invalidated.

## Installation

This extension is part of the Salesforce Extension Pack for Visual Studio Code.

## Development

### Testing

This extension includes Playwright tests for both web and desktop (Electron) environments with shared test logic.

#### Quick Test Commands

Run from the repository root:

```bash
pnpm install
pnpm --filter salesforcedx-vscode-org-browser compile
pnpm --filter salesforcedx-vscode-org-browser test:web
pnpm --filter salesforcedx-vscode-org-browser test:desktop
pnpm --filter salesforcedx-vscode-org-browser test:e2e
pnpm --filter salesforcedx-vscode-org-browser test:web:ui
```

#### Environment Setup

Tests use `DREAMHOUSE_ORG_ALIAS` to locate a pre-configured Salesforce org:

```bash
export DREAMHOUSE_ORG_ALIAS=myTestOrg
sf org display -o myTestOrg
```

In CI, the org is created automatically. For local development, reuse an existing org to avoid creating a scratch org for each test run.

#### Manual Testing

```bash
pnpm run run:web
```

This opens VS Code web in Chrome with DevTools. For org credentials and settings injection, see [docs/QA.md](../../docs/QA.md). Check the Explorer's Org Browser view and the browser console for errors.

#### Test Structure

```text
test/playwright/
├── specs/       # Shared web and desktop test specs
├── fixtures/    # Platform-specific setup
├── pages/       # Shared page objects
├── utils/       # Test utilities
└── web/         # Web-only infrastructure
```

Desktop tests use a worker-scoped VS Code download and each test receives a fresh Electron instance with an isolated workspace. See [docs/QA.md](../../docs/QA.md), [docs/Build.md](../../docs/Build.md), and [contributing/developing.md](../../contributing/developing.md) for troubleshooting.

## Contributing

See the [contributing guide](../../CONTRIBUTING.md).

## License

[BSD 3-Clause License](LICENSE.txt)
