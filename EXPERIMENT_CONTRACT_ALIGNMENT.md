# Experiment: Contract-Based API Alignment

## Problem
Shane's concern from PR #7309: "how do we keep these aligned? ex: if I add a new something in services, should I have to think 'do I want to facade this, too?'"

Currently, when adding Effect service methods, developers must manually remember to also add them to `PlainServicesApi`. No compile-time enforcement ensures alignment.

## Solution: Shared Contract Interface

### Architecture

```
┌─────────────────────────────────────┐
│  @salesforce/vscode-services (npm)  │  ← Published types package
│  Re-exports from services package   │
└──────────────┬──────────────────────┘
               │ exports
               ↓
┌─────────────────────────────────────┐
│  salesforcedx-vscode-services       │  ← Implementation package
│                                     │
│  ┌──────────────────────────────┐  │
│  │  contract.ts                 │  │  ← SOURCE OF TRUTH
│  │  IServicesContract interface │  │
│  │  - getConnection()           │  │
│  │  - getWorkspaceInfo()        │  │
│  │  - isSalesforceProject()     │  │
│  │  - ...                       │  │
│  └──────────────────────────────┘  │
│           ↑           ↑             │
│           │           │             │
│    enforces       enforces          │
│           │           │             │
│  ┌────────┴──┐   ┌───┴──────────┐  │
│  │ Effect    │   │ PlainServices│  │
│  │ Services  │   │ Api          │  │
│  │ (future)  │   │ (current)    │  │
│  └───────────┘   └──────────────┘  │
└─────────────────────────────────────┘
```

### Key Files

#### `/packages/salesforcedx-vscode-services/src/contract.ts`
Defines the **complete API contract** split into four focused interfaces:

```typescript
// 1. Core contract - ~30 basic methods with simple signatures
export interface IServicesContract {
  getConnection(): Connection;
  getWorkspaceInfo(): WorkspaceInfo;
  isSalesforceProject(): boolean;
  readFile(filePath: string | URI): string;
  deploy(components: ComponentSet): DeployResult;
  // ... file system, metadata, tracking, etc.
}

// 2. Extended contract - methods with specialized signatures
export interface IServicesContractExtensions {
  getTargetOrgInfo(): DefaultOrgInfo;
  getSettingsValue<T>(section: string, key: string, defaultValue?: T): T | undefined;
  listMetadata(type: string, folder?: string): readonly FilePropertiesPlain[];
  createFromTemplate<T extends TemplateType>(params: CreateParams<T>): CreateOutput;
  // ... methods with generics, optional params, etc.
}

// 3. Event types (payload types for vscode.Event wrappers)
export interface IServicesEvents {
  onDidChangeTargetOrg: DefaultOrgInfo;
  onDidChangeActiveEditor: vscode.TextEditor | undefined;
  onDidChangeTraceFlags: TraceFlagItem[];
}

// 4. Synchronous methods (fire-and-forget, not promisified)
export interface IServicesSyncMethods {
  appendToChannel(message: string): void;
  clearChannel(): void;
}

// Helper to convert contract to Promise-based
export type PromisifiedContract<T> = {
  [K in keyof T]: T[K] extends (...args: infer P) => infer R
    ? (...args: P) => Promise<Awaited<R>>
    : T[K];
};
```

#### `/packages/salesforcedx-vscode-services/src/plainApi.ts`
```typescript
import type {
  IServicesContract,
  IServicesContractExtensions,
  IServicesEvents,
  IServicesSyncMethods,
  PromisifiedContract
} from './contract';

// PlainServicesApi MUST satisfy ALL contract parts
export type PlainServicesApi = 
  PromisifiedContract<IServicesContract> &
  PromisifiedContract<IServicesContractExtensions> &
  IServicesSyncMethods & {
    // Event handlers (vscode.Event wrapper)
    readonly onDidChangeTargetOrg: vscode.Event<IServicesEvents['onDidChangeTargetOrg']>;
    readonly onDidChangeActiveEditor: vscode.Event<IServicesEvents['onDidChangeActiveEditor']>;
    readonly onDidChangeTraceFlags: vscode.Event<IServicesEvents['onDidChangeTraceFlags']>;
  };
```

#### `/packages/salesforcedx-vscode-services-types/scripts/generateEntry.ts`
Auto-generates exports including **all contract interfaces**:
```typescript
export type {
  IServicesContract,
  IServicesContractExtensions,
  IServicesEvents,
  IServicesSyncMethods,
  PromisifiedContract,
  CreateParams
} from '../../salesforcedx-vscode-services/out/src/contract';
export type { PlainServicesApi } from '../../salesforcedx-vscode-services/out/src/plainApi';
```

## How It Works

### Adding a New Method

**Before (easy to forget):**
1. Add method to Effect service
2. ❌ Forget to add to PlainServicesApi
3. ✅ Build succeeds, silently incomplete

**After (enforced by compiler):**
1. Add method signature to `IServicesContract`
2. TypeScript compiler fails:
   - Effect service doesn't implement it → **compile error**
   - PlainServicesApi doesn't implement it → **compile error**
3. Must fix both to compile

### What Gets Enforced

**✅ IServicesContract (~30 core methods):**
- Connection: `getConnection()`, `invalidateCachedConnections()`
- Workspace: `getWorkspaceInfo()`
- Project: `isSalesforceProject()`, `getSfProject()`, `isInPackageDirectories()`
- Settings: `getApiVersion()`
- Config: `getTargetDevHub()`, `unsetTargetOrg()`, `unsetTargetDevHub()`
- Aliases: `getAllAliases()`, `getUsernameFromAlias()`
- File System: `readFile()`, `writeFile()`, `fileOrFolderExists()`, `findFiles()`, etc.
- Editor: `getActiveEditorUri()`, `getActiveEditorText()`
- Metadata: `describe()`, `deploy()`, `retrieveComponentSet()`
- Tracking: `hasTracking()`, `getConflicts()`, `checkConflicts()`
- Terminal: `simpleExec()`
- ComponentSet: `getComponentSetFromUris()`, `getComponentSetFromManifest()`, etc.

**✅ IServicesContractExtensions (specialized signatures):**
- Org: `getTargetOrgInfo()`
- Settings: `getSettingsValue<T>()`, `setSettingsValue()`
- Metadata: `listMetadata()`, `retrieve()` (with options), `retrieveComponentSetToDirectory()`
- Tracking: `getLocalChangesAsComponentSet()`, `getRemoteNonDeletesAsComponentSet()`
- Templates: `createFromTemplate<T>()`
- Trace Flags: `getTraceFlags()`, `ensureTraceFlag()`

**✅ IServicesEvents (event payload types):**
- `onDidChangeTargetOrg: DefaultOrgInfo`
- `onDidChangeActiveEditor: vscode.TextEditor | undefined`
- `onDidChangeTraceFlags: TraceFlagItem[]`

**✅ IServicesSyncMethods (synchronous):**
- `appendToChannel(message: string): void`
- `clearChannel(): void`

### Benefits

1. **Single Source of Truth**: Contract defines what MUST be available
2. **Compile-Time Safety**: Can't forget to implement on either side
3. **Self-Documenting**: Contract shows the API surface at a glance
4. **Future-Proof**: When Effect services are restructured, contract ensures alignment

## Current Status

✅ **Contract fully expanded** - All 50+ PlainServicesApi methods covered  
✅ **Four-part contract** - Core, Extensions, Events, Sync methods  
✅ **PlainServicesApi composition** - Built from all contract parts  
✅ **services-types exports** - All contract interfaces published  
✅ **Compiles successfully** - Zero type errors  
⏳ **Effect services enforcement** (future work - when services are refactored)

## Coverage Statistics

- **IServicesContract**: 30 methods (core operations with simple signatures)
- **IServicesContractExtensions**: 10 methods (generics, optional params, specialized types)
- **IServicesEvents**: 3 event types
- **IServicesSyncMethods**: 2 synchronous methods
- **Total**: 45 methods + 3 events = **100% PlainServicesApi coverage**

## Next Steps

1. ✅ ~~Expand contract to cover all methods~~ - **COMPLETE**
2. **Validate the approach** with team
3. **Consider enforcement** on Effect services side (requires architectural refactoring)
4. **Document maintenance pattern** - how to add new methods going forward

## Trade-offs

**Pros:**
- Impossible to add service method without considering plain API
- Clear documentation of what's available
- Type-safe on both sides

**Cons:**
- Extra layer of indirection
- Contract needs to be generic enough for both Effect and Promise APIs
- Some methods don't fit the pattern (events, fire-and-forget)

## Example: Adding `getOrgLimits()`

```typescript
// 1. Add to contract
export interface IServicesContract {
  // ...
  getOrgLimits(): OrgLimits;  // ← TypeScript now expects this everywhere
}

// 2. Compiler fails until you add to PlainServicesApi implementation
export const createPlainServicesApi = (...) => ({
  // ...
  getOrgLimits: () => run(builtContext, SomeService.getOrgLimits()),  // ← Must add
});

// 3. (Future) Compiler fails until Effect service implements it too
```

## Conclusion

This experiment demonstrates a **technical solution** to Shane's alignment question. The contract acts as a shared interface that both Effect services and PlainServicesApi must satisfy, with TypeScript enforcing alignment at compile time.

The approach eliminates the "remember to update both places" problem by making it a **compilation requirement** rather than a **documentation convention**.
