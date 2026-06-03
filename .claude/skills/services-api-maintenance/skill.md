---
name: services-api-maintenance
description: Guidelines for adding, removing, or modifying APIs in salesforcedx-vscode-services extension. Use when adding new service methods, updating PlainServicesApi, maintaining the contract interfaces (IServicesContract, IServicesContractExtensions), or ensuring API alignment between Effect services and plain Promise-based facades.
---

# Services Extension API Maintenance

Guidelines for maintaining the `salesforcedx-vscode-services` API surface.

## Architecture Overview

The services extension exposes APIs through a **contract-based system**:

```
┌─────────────────────────────────────┐
│  Contract Interfaces (contract.ts)  │  ← SOURCE OF TRUTH
│  - IServicesContract                │
│  - IServicesContractExtensions      │
│  - IServicesEvents                  │
│  - IServicesSyncMethods             │
└──────────────┬──────────────────────┘
               ↓ enforces
┌─────────────────────────────────────┐
│  PlainServicesApi (plainApi.ts)     │  ← Promise-based facade
│  = PromisifiedContract<...>         │
└─────────────────────────────────────┘
```

**Key files:**
- `packages/salesforcedx-vscode-services/src/contract.ts` - API contracts
- `packages/salesforcedx-vscode-services/src/plainApi.ts` - Promise-based implementation
- `packages/salesforcedx-vscode-services-types/scripts/generateEntry.ts` - Exports to npm

## Adding a New API Method

### Step 1: Determine Contract Placement

Choose the appropriate contract based on the method signature:

**IServicesContract** - Simple, basic signatures:
```typescript
readonly methodName: (param: Type) => ReturnType;
```
- No generics
- No complex optional parameters
- Straightforward return types

**IServicesContractExtensions** - Specialized signatures:
```typescript
readonly methodName: <T>(param: Type, optional?: T) => ComplexType<T>;
```
- Generic type parameters
- Complex optional parameters
- Specialized return types

**IServicesEvents** - Event payload types:
```typescript
readonly eventName: PayloadType;
```
- For `vscode.Event<T>` wrappers
- Defines payload type only

**IServicesSyncMethods** - Synchronous methods:
```typescript
readonly methodName: (param: Type) => void;
```
- Fire-and-forget operations
- Not promisified

### Step 2: Add to Contract

**Example: Adding a simple method to IServicesContract**

```typescript
// In contract.ts
export type IServicesContract = {
  // ... existing methods
  
  // New method
  readonly getOrgLimits: () => OrgLimits;
};
```

**Example: Adding a specialized method to IServicesContractExtensions**

```typescript
// In contract.ts
export type IServicesContractExtensions = {
  // ... existing methods
  
  // New method with generics
  readonly queryRecords: <T extends SObject>(
    query: string,
    options?: QueryOptions
  ) => QueryResult<T>;
};
```

### Step 3: Implement in PlainServicesApi

The contract automatically constrains PlainServicesApi through `PromisifiedContract<T>`. 

**For IServicesContract/IServicesContractExtensions methods:**

TypeScript will show a compile error until you implement it in `createPlainServicesApi`:

```typescript
// In plainApi.ts - createPlainServicesApi function
export const createPlainServicesApi = (
  builtContext: ServicesContext,
  extensionScope: Scope.CloseableScope
): PlainServicesApi => {
  // ... existing methods
  
  return {
    // ... existing implementations
    
    // NEW: Implement the new method
    getOrgLimits: () => run(builtContext, SomeService.getOrgLimits()),
  };
};
```

**For IServicesEvents:**

Add to the event handlers section:

```typescript
export type PlainServicesApi = 
  PromisifiedContract<IServicesContract> &
  PromisifiedContract<IServicesContractExtensions> &
  IServicesSyncMethods & {
    // ... existing events
    
    // NEW: Add event handler
    readonly onOrgLimitsChanged: vscode.Event<IServicesEvents['onOrgLimitsChanged']>;
  };
```

Then wire up the emitter:

```typescript
const orgLimitsEmitter = new EventEmitter<OrgLimits>();

// Add finalizer for cleanup
void Effect.runPromise(
  Scope.addFinalizer(
    extensionScope,
    Effect.sync(() => {
      orgLimitsEmitter.dispose();
    })
  )
);

// Wire up the stream
void Effect.runPromise(
  Effect.forkIn(
    Effect.gen(function* () {
      const service = yield* SomeService;
      yield* Stream.fromPubSub(service.limitsChanged).pipe(
        Stream.runForEach(limits => Effect.sync(() => orgLimitsEmitter.fire(limits)))
      );
    }).pipe(Effect.provide(Layer.succeedContext(builtContext))),
    extensionScope
  )
);
```

### Step 4: Update Exports

The contract types are automatically exported through `generateEntry.ts`. Verify exports include all contract interfaces:

```typescript
// In generateEntry.ts
export type {
  IServicesContract,
  IServicesContractExtensions,
  IServicesEvents,
  IServicesSyncMethods,
  PromisifiedContract,
  CreateParams
} from '../../salesforcedx-vscode-services/out/src/contract';
```

### Step 5: Verify

```bash
# Compile - TypeScript will error if contract not satisfied
npm run compile -w salesforcedx-vscode-services

# Lint
npm run lint -w salesforcedx-vscode-services

# Full build
npm run compile
```

## Removing an API Method

### Step 1: Check for External Usage

Before removing, verify no external consumers depend on it:

```bash
# Search consuming extensions
grep -r "methodName" packages/salesforcedx-vscode-*/src/
```

See the `external-consumers` skill for known API consumers.

### Step 2: Deprecate First (Recommended)

Add deprecation notice via JSDoc:

```typescript
export type IServicesContract = {
  /**
   * @deprecated Use newMethodName instead. Will be removed in v68.
   */
  readonly oldMethodName: () => ReturnType;
};
```

### Step 3: Remove from Contract

Remove from the appropriate contract interface in `contract.ts`.

### Step 4: Remove from PlainServicesApi

Remove the implementation from `createPlainServicesApi` in `plainApi.ts`.

TypeScript will error if you forget - the contract enforces completeness.

### Step 5: Update Documentation

Update relevant documentation:
- README.md in services package
- CHANGELOG.md (breaking change)
- Migration guide if needed

## Modifying an Existing API

### Changing Signature (Breaking Change)

1. **Add new method** with desired signature
2. **Deprecate old method** pointing to new one
3. **Wait 1-2 releases** before removing

### Adding Optional Parameter (Non-Breaking)

Safe to add optional parameters to contract:

```typescript
// Before
readonly deploy: (components: ComponentSet) => DeployResult;

// After (non-breaking)
readonly deploy: (components: ComponentSet, options?: DeployOptions) => DeployResult;
```

Update both contract and implementation.

## Import Order Rules

Lint enforces strict import order in `contract.ts`:

```typescript
// 1. Local project imports (./core/...)
import type { NonEmptyComponentSet } from './core/componentSetService';
import type { DefaultOrgInfo } from './core/schemas/defaultOrgInfoPlain';

// 2. npm package imports
import type { Connection } from '@salesforce/core';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import type * as vscode from 'vscode';
```

## Type vs Interface Rules

Contract definitions MUST be `type` with property signatures (enforced by lint):

```typescript
// ✅ CORRECT
export type IServicesContract = {
  readonly methodName: () => ReturnType;
};

// ❌ WRONG (lint error)
export interface IServicesContract {
  methodName(): ReturnType;
}
```

## Testing New APIs

After adding a new API:

1. **Unit test** the Effect service implementation
2. **Integration test** through PlainServicesApi
3. **Manual test** in a consuming extension (e.g., metadata extension)

Example test:

```typescript
describe('PlainServicesApi.newMethod', () => {
  it('should return expected result', async () => {
    const api = await getTestApi();
    const result = await api.newMethod();
    expect(result).toBeDefined();
  });
});
```

## Common Patterns

### Adding a Simple Query Method

```typescript
// 1. Contract
export type IServicesContract = {
  readonly getOrgUsers: () => User[];
};

// 2. Implementation
getOrgUsers: () => run(builtContext, ConnectionService.getOrgUsers()),
```

### Adding a Method with Options

```typescript
// 1. Contract (Extensions for complex signatures)
export type IServicesContractExtensions = {
  readonly query: (soql: string, options?: QueryOptions) => QueryResult;
};

// 2. Implementation
query: (soql: string, options?: QueryOptions) => 
  run(builtContext, SomeService.query(soql, options)),
```

### Adding an Event

```typescript
// 1. Contract - event payload type
export type IServicesEvents = {
  readonly onConfigChanged: ConfigChangeEvent;
};

// 2. PlainServicesApi type
readonly onConfigChanged: vscode.Event<IServicesEvents['onConfigChanged']>;

// 3. Implementation - wire up emitter and stream
const configEmitter = new EventEmitter<ConfigChangeEvent>();
// ... add finalizer for cleanup
// ... wire to Effect stream
```

## Troubleshooting

### "Type X is not assignable to PlainServicesApi"

**Cause:** Contract requires a method that's not implemented.

**Fix:** Add the missing method to `createPlainServicesApi` return object.

### "All imports in import declaration are unused"

**Cause:** Type is imported but only used in the contract (which is exported).

**Fix:** Remove the unused import - the consuming package will import from the contract.

### "Import order" lint error

**Cause:** Local imports must come before npm package imports.

**Fix:** Reorder imports - `./` imports first, then `@salesforce/` and other packages.

### Method not appearing in autocomplete for consumers

**Cause:** Either not in contract, or contract not exported.

**Fix:** 
1. Verify method is in appropriate contract interface
2. Check `generateEntry.ts` exports all contract interfaces
3. Rebuild: `npm run compile`

## Related Skills

- **services-extension-consumption** - How consumers use the API
- **external-consumers** - Known API consumers and their usage patterns
- **effect-best-practices** - Effect service implementation patterns

## Reference

- Contract definition: `packages/salesforcedx-vscode-services/src/contract.ts`
- Implementation: `packages/salesforcedx-vscode-services/src/plainApi.ts`
- Exports: `packages/salesforcedx-vscode-services-types/scripts/generateEntry.ts`
- Architecture: `EXPERIMENT_CONTRACT_ALIGNMENT.md`
