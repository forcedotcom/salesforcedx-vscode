# TODO

consider the code in the vscode-core/orgBrowser folder.

I want to replicate the UI

## Phases

1. read-only metadata list/describe (no ability to retrieve anything)

## Differences from existing

1. everything should use Effect library
2. Let's do as much functional-style programming as possible with effect
3. anything that's a "service" (getting a connection, etc) should go in the Services package's exports and be called from here
4. we'll store our files in .sf/orgs/<orgId>/metadata. The format should match the describe results, not the existing files
5. this must not use any node: apis...it needs to run as a web and desktop extension

## Guidelines

- no direct (runtime) dependencies on salesforcedx-vscode-services repo
  - you can have a devDep (only using its types, with the `type` annotation)
  - you an have an indirect "runtime" dependency via vscode's extensionDependencies (packages use the vscode-services package's API and can depend on it being running)

## Clarifying Questions

### UI Replication: Do you want to replicate the entire Org Browser UI (tree view, icons, etc.) or just the underlying data/model logic for now?

yeah, let's keep the UI consistent at first. We can change it up later if needed. same icons, branding, etc.

### Effect Library: Should all VS Code commands, tree providers, and data fetching use Effect, or only the backend/data layer?

As much as possible. See how far we can go with it. If anything seems odd, ask me

## Services Package: Is there an existing Services package you want to use, or should I create new service abstractions as needed?

salesforcedx-vscode-services

## File Storage: For Phase 1 (read-only), do you want to implement the file storage logic now, or defer until retrieval is supported?

implement it for storing the list/describe results. Format will be json.

## Describe Results Format: Can you clarify if you want to store the raw describe API response, or a normalized/filtered version?

let's do it raw. Those are standard Salesforce API calls

## Testing: Should I set up tests for the new Effect-based code, and if so, do you have a preferred test framework or style?

jest, mimimal mocking, use Effect's https://effect.website/docs/requirements-management/layers/#injecting-test-dependencies or https://effect.website/docs/requirements-management/layers/#mocking-the-service-directly

you may need to do some mocks of the vscode (types-only) package, but let's try to avoid that.

## OrgId Source: Where should I get the <orgId> for the storage path? Is there a service/util in salesforcedx-vscode-services I should use, or should I add one if missing?

Probably easiest to get via from the connectionService.

## Tree Refresh: Should the UI auto-refresh when new describe results are fetched/stored, or only on manual user action?

auto-refresh

## Error Handling: Any preferred pattern for surfacing errors to the user (e.g., channel, notification, both)?

use notifications and channel

## Describe API: Should I support both Tooling and Metadata API describe, or just one? (The current Org Browser uses Metadata API.)

metadata api

---

## Future features

effect/caching https://effect.website/docs/caching/caching-effects/
l18n of all text and pjson text
