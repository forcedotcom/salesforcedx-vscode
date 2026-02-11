---
name: Refactor metadataDescribeService to use Cache.make
overview: Refactor MetadataDescribeService to use Cache.make pattern like configService and projectService, replacing Effect.cachedFunction with a module-level cache.
todos:
  - id: add-imports
    content: Add Cache and Duration imports to metadataDescribeService.ts
    status: completed
  - id: extract-lookup
    content: Extract performDescribe lookup function from cacheableDescribe logic
    status: completed
  - id: create-cache
    content: Create module-level globalDescribeCache using Cache.make
    status: completed
  - id: update-service
    content: Update service effect to use cache.get() instead of Effect.cachedFunction
    status: completed
  - id: handle-refresh
    content: Update describe function to handle forceRefresh by bypassing cache
    status: completed
isProject: false
---

## Refactoring MetadataDescribeService to use Cache.make

Refactor `metadataDescribeService.ts` to follow the same caching pattern as `configService.ts` and `projectService.ts`.

### Current Implementation

- Uses `cacheableDescribe` function with unused key parameter
- Uses `Effect.cachedFunction` inside the service effect
- `forceRefresh` bypasses cache by using unique timestamp keys

### Target Implementation

- Extract lookup function (`performDescribe`) that performs the describe operation
- Create module-level cache using `Cache.make` (outside the service class)
- Update `describe` function to use `cache.get()` with a constant key
- Handle `forceRefresh` by calling the lookup function directly when true

### Changes Required

1. **Add imports** in `[metadataDescribeService.ts](packages/salesforcedx-vscode-services/src/core/metadataDescribeService.ts)`:

- `import * as Cache from 'effect/Cache'`
- `import * as Duration from 'effect/Duration'`

1. **Extract lookup function** (before the service class):

- Create `performDescribe` function that takes no parameters (or a dummy key)
- Move the describe logic from `cacheableDescribe` into this function
- Remove the unused `_key` parameter

1. **Create module-level cache**:

- Use `Effect.runSync(Cache.make({ ... }))` to create `globalDescribeCache`
- Set appropriate `capacity` and `timeToLive` (e.g., 30 minutes like configService)
- Use `performDescribe` as the lookup function

1. **Update service effect**:

- Remove `cacheableDescribe` and `cachedDescribe`
- Update `describe` function to:
  - Use `globalDescribeCache.get('describe')` when `forceRefresh` is false
  - Call `performDescribe('describe')` directly when `forceRefresh` is true (or invalidate then get)

### Key Considerations

- The describe operation doesn't take meaningful parameters, so use a constant key like `'describe'`
- `forceRefresh` should bypass cache - either call lookup directly or invalidate then get
- Keep the same error handling and tracing spans
- Maintain the same public API (the `describe` function signature stays the same)
