---
name: Filter ignored and sort with Effect
overview: Update the source tracking status bar to exclude ignored changes and sort changes using Effect's Order module for type-safe, composable sorting by type then name.
todos:
  - id: add-order-import
    content: Add Effect Order import to helpers.ts
    status: pending
  - id: create-status-row-order
    content: Create statusRowOrder using Order.tuple and Order.mapInput for type,name sorting
    status: pending
  - id: filter-ignored-in-dedupe
    content: Update dedupeStatus to filter out ignored changes before deduplication
    status: pending
  - id: apply-sorting
    content: Apply statusRowOrder sorting in separateChanges for all three arrays
    status: pending
---

# Filter ignored changes and sort with Effect Order

## Current State

- `dedupeStatus` in `helpers.ts` deduplicates but doesn't filter ignored changes
- No sorting applied to the hover tooltip items
- Already using Effect throughout the codebase

## Changes to [`helpers.ts`](packages/salesforcedx-vscode-metadata/src/statusBar/helpers.ts)

### 1. Add Effect Order import and create sort Order

Using [Effect Order](https://effect.website/docs/behaviour/order/) to define a composable ordering:

```typescript
import * as Order from 'effect/Order';

/** Sort by type (case-insensitive), then fullName (case-insensitive) */
const statusRowOrder: Order.Order<StatusOutputRow> = Order.mapInput(
  Order.tuple(Order.string, Order.string),
  (row: StatusOutputRow) => [row.type.toLowerCase(), row.fullName.toLowerCase()] as const
);
```

This uses `Order.tuple` to combine two string orderings and `Order.mapInput` to extract the comparison values from `StatusOutputRow`.

### 2. Filter ignored in `dedupeStatus`

Add `.filter(row => !row.ignored)` before deduplication to exclude ignored changes early:

```typescript
export const dedupeStatus = (status: StatusOutputRow[]): StatusOutputRow[] => {
  const notIgnored = status.filter(row => !row.ignored);
  // ... rest of deduplication logic using notIgnored
};
```

### 3. Apply sorting in `separateChanges`

Sort each array using `Array.sort` with the Effect Order:

```typescript
export const separateChanges = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const localChanges = status
    .filter(row => row.origin === 'local' && !row.conflict && !row.ignored)
    .toSorted(statusRowOrder);
  const remoteChanges = status
    .filter(row => row.origin === 'remote' && !row.conflict && !row.ignored)
    .toSorted(statusRowOrder);
  const conflicts = status.filter(row => row.conflict && !row.ignored).toSorted(statusRowOrder);

  return { localChanges, remoteChanges, conflicts };
};
```

## Why Effect Order?

- **Type-safe**: The `Order<StatusOutputRow>` ensures we're comparing the right type
