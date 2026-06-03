---
name: services-api-design
description: Decision framework for determining whether a new service method should be exposed through the public PlainServicesApi surface. Use when designing new services functionality, evaluating API surface additions, or deciding if an Effect service method should be consumer-facing vs internal-only.
---

# Services API Design Decisions

Framework for deciding whether new functionality should be exposed through the public `PlainServicesApi` surface.

## Decision Framework

Use this flowchart to evaluate whether a service method should be public:

```
New Service Method
        ↓
    [1. Is it stable?]
        ↓ YES
    [2. Is it consumer-facing?]
        ↓ YES
    [3. Can it be Promise-based?]
        ↓ YES
    [4. Is the API surface appropriate?]
        ↓ YES
    ✅ ADD TO PlainServicesApi
    
    ↓ NO at any step
    ❌ KEEP INTERNAL (Effect-only)
```

## Detailed Evaluation Criteria

### 1. Stability Assessment

**Expose if:**
- ✅ Functionality is well-tested and battle-hardened
- ✅ API signature is unlikely to change
- ✅ Implementation details are settled
- ✅ Has been used internally for 1+ sprints

**Keep internal if:**
- ❌ Experimental or proof-of-concept
- ❌ API shape still evolving
- ❌ Implementation approach may change
- ❌ Requires more validation before stabilization

**Example:**
```typescript
// ✅ STABLE - expose
readonly getConnection: () => Connection;  // Well-established, won't change

// ❌ UNSTABLE - keep internal
readonly experimentalAICodegen: () => CodeSuggestion;  // New, may change
```

### 2. Consumer-Facing Assessment

**Expose if:**
- ✅ Multiple extensions would benefit from this
- ✅ Reduces code duplication across extensions
- ✅ Provides core Salesforce functionality (orgs, metadata, auth)
- ✅ Abstracts complex operations consumers need

**Keep internal if:**
- ❌ Only used by services extension itself
- ❌ Implementation detail of another public method
- ❌ Too low-level or granular for typical use cases
- ❌ Specific to one consumer (add to that extension instead)

**Example:**
```typescript
// ✅ CONSUMER-FACING - expose
readonly deploy: (components: ComponentSet) => DeployResult;
// Used by: metadata, apex, lwc extensions

// ❌ INTERNAL - keep internal
readonly parseMetadataXml: (xml: string) => MetadataObject;
// Implementation detail, consumers use higher-level deploy()
```

### 3. Promise-Based Compatibility

**Expose if:**
- ✅ Returns a single result (can be awaited)
- ✅ Doesn't require Effect-specific error handling
- ✅ No need for stream/reactive patterns
- ✅ Can convert Effect → Promise cleanly

**Keep internal if:**
- ❌ Returns a Stream (continuous data)
- ❌ Requires complex Effect composition
- ❌ Needs fine-grained Effect error handling
- ❌ Benefits significantly from Effect context

**Example:**
```typescript
// ✅ PROMISE-COMPATIBLE - expose
readonly getSfProject: () => SfProject;  // Single result

// ❌ EFFECT-SPECIFIC - keep internal  
readonly watchConfigChanges: () => Stream<ConfigChange>;  // Stream, not Promise
```

### 4. API Surface Appropriateness

**Expose if:**
- ✅ Method name is clear and self-documenting
- ✅ Parameters are simple and well-typed
- ✅ Fits conceptually with existing API surface
- ✅ Doesn't leak implementation details

**Keep internal if:**
- ❌ Requires extensive documentation to understand
- ❌ Complex parameter objects with many options
- ❌ Name would confuse consumers
- ❌ Exposes Effect implementation details

**Example:**
```typescript
// ✅ APPROPRIATE - expose
readonly getTargetOrgInfo: () => DefaultOrgInfo;  // Clear, simple

// ❌ INAPPROPRIATE - keep internal
readonly _buildConfigAggregatorWithStateCache: (
  opts: ComplexInternalOptions
) => ConfigAggregator;  // Internal implementation detail
```

## Special Cases

### Case 1: Event Handlers

**Expose if** the event represents:
- State changes consumers need to react to (org changes, file changes)
- User actions (editor changes, selection changes)
- System notifications (config updates, errors)

```typescript
// ✅ EXPOSE
readonly onDidChangeTargetOrg: vscode.Event<DefaultOrgInfo>;

// ❌ KEEP INTERNAL  
readonly onInternalCacheInvalidated: vscode.Event<void>;
```

### Case 2: Synchronous Methods

**Expose if:**
- Fire-and-forget operations (logging, notifications)
- Quick, non-blocking operations
- UI updates (channel output, status bar)

```typescript
// ✅ EXPOSE
readonly appendToChannel: (message: string) => void;

// ❌ KEEP INTERNAL
readonly _updateInternalMetrics: () => void;
```

### Case 3: Generic Methods

**Expose if:**
- Generic types are well-bounded and documented
- Consumers understand the type parameter
- Type safety is maintained across the boundary

```typescript
// ✅ EXPOSE
readonly getSettingsValue: <T>(section: string, key: string) => T | undefined;

// ❌ KEEP INTERNAL (too complex)
readonly _transformWithContext: <A, E, R>(
  effect: Effect<A, E, R>,
  transform: <B>(a: A) => Effect<B, E, R>
) => Effect<B, E, R>;
```

## Examples by Category

### ✅ GOOD CANDIDATES for PlainServicesApi

**Org & Auth:**
```typescript
readonly getConnection: () => Connection;
readonly getTargetOrgInfo: () => DefaultOrgInfo;
readonly invalidateCachedConnections: () => void;
readonly onDidChangeTargetOrg: vscode.Event<DefaultOrgInfo>;
```

**Metadata Operations:**
```typescript
readonly deploy: (components: ComponentSet) => DeployResult;
readonly retrieve: (members: MetadataMember[]) => RetrieveResult;
readonly describe: () => DescribeMetadataObject[];
```

**File System:**
```typescript
readonly readFile: (path: URI) => string;
readonly writeFile: (path: URI, content: string) => void;
readonly fileOrFolderExists: (path: URI) => boolean;
```

**Project & Workspace:**
```typescript
readonly isSalesforceProject: () => boolean;
readonly getSfProject: () => SfProject;
readonly getWorkspaceInfo: () => WorkspaceInfo;
```

### ❌ KEEP INTERNAL (Effect-only)

**Implementation Details:**
```typescript
// Too low-level
readonly _parseAuthUrl: (url: string) => AuthToken;
readonly _buildLayerForService: <S>(service: S) => Layer<S>;

// Internal state management
readonly _invalidateCache: (key: string) => void;
readonly _refreshInternalState: () => Effect<void>;

// Effect-specific composition
readonly _withRetry: <A, E>(effect: Effect<A, E>) => Effect<A, E>;
```

**Experimental/Unstable:**
```typescript
// Not stable yet
readonly experimentalGenerateCode: (prompt: string) => Code;
readonly prototypeAIAssist: (context: Context) => Suggestion;
```

**Stream-Based:**
```typescript
// Requires Effect streams
readonly watchFileChanges: (glob: string) => Stream<FileChange>;
readonly subscribeToOrgEvents: () => Stream<OrgEvent>;
```

## Decision Checklist

Before adding a new method to `PlainServicesApi`, verify:

- [ ] **Stable**: API has been used internally for 1+ sprints
- [ ] **Consumer need**: At least 2 extensions would benefit
- [ ] **Promise-compatible**: Can return single result via Promise
- [ ] **Clear signature**: Method name and parameters are self-explanatory
- [ ] **Proper placement**: Fits in IServicesContract or IServicesContractExtensions
- [ ] **Documented**: Has JSDoc with usage example
- [ ] **Tested**: Has unit + integration tests
- [ ] **No leaks**: Doesn't expose Effect implementation details

If all checked ✅ → **Add to contract and PlainServicesApi**

If any unchecked ❌ → **Keep Effect-only, revisit later**

## Migration Strategy

If a method starts as internal and later becomes stable:

1. **Stabilize internally** - Use in services extension for 1-2 sprints
2. **Validate with one consumer** - Add to one extension as proof of concept
3. **Refine API** - Adjust based on real usage
4. **Add to contract** - Follow the services-api-maintenance skill
5. **Announce** - Add to CHANGELOG as new public API

## Anti-Patterns

**❌ Don't expose just because it exists**
```typescript
// Bad: Exposing internal utility
readonly _internalHelperMethod: () => void;  // NO!
```

**❌ Don't expose Effect-specific patterns**
```typescript
// Bad: Leaking Effect abstractions
readonly getConnectionEffect: () => Effect<Connection, AuthError>;  // NO!
// Good: Hide Effect behind Promise
readonly getConnection: () => Promise<Connection>;  // YES!
```

**❌ Don't expose unstable experiments**
```typescript
// Bad: Exposing experimental API
readonly betaFeature: () => Result;  // NO! Wait until stable
```

**❌ Don't duplicate existing functionality**
```typescript
// Bad: Already have getConnection()
readonly getAuthenticatedConnection: () => Connection;  // NO! Redundant
```

## Best Practices

### 1. Start Conservative

When in doubt, **keep it internal**. It's easier to add to the public API later than to remove/deprecate.

### 2. Prototype Internally First

Use new methods in the services extension itself before exposing. Real usage reveals API design issues.

### 3. Consider Composition

Can consumers achieve the goal by composing existing APIs? If yes, don't add a new one.

```typescript
// Instead of adding:
readonly deployAndPoll: (components: ComponentSet) => DeployResult;

// Consumers can compose:
const result = await api.deploy(components);
// ... then poll using existing methods
```

### 4. Future-Proof the Signature

Design the API to accommodate future additions without breaking changes:

```typescript
// ✅ Good: Can add options later
readonly retrieve: (members: MetadataMember[], options?: RetrieveOptions) => RetrieveResult;

// ❌ Bad: Adding options later is breaking
readonly retrieve: (members: MetadataMember[]) => RetrieveResult;
```

### 5. Document the "Why"

Add JSDoc explaining **why** the method exists and **when** to use it:

```typescript
/**
 * Retrieves metadata from the target org.
 * 
 * Use this when you need to fetch metadata definitions.
 * For source tracking, use getLocalChangesAsComponentSet() instead.
 * 
 * @param members - Metadata types and names to retrieve
 * @returns Retrieve result with file paths and status
 */
readonly retrieve: (members: MetadataMember[]) => RetrieveResult;
```

## Related Skills

- **services-api-maintenance** - How to add/remove APIs once designed
- **services-extension-consumption** - How consumers use the API
- **external-consumers** - Known consumers and their patterns
- **effect-best-practices** - Internal Effect service patterns

## Questions to Ask

When evaluating a new API candidate, ask:

1. **Who needs this?** Name specific extensions that would benefit.
2. **Why can't they do it themselves?** What complexity does this abstract?
3. **What's the simplest signature?** Remove optional params until proven needed.
4. **How would I test this?** If testing is complex, API may be too complex.
5. **What can go wrong?** Error cases should be obvious to consumers.
6. **Will this change?** If implementation might change, keep internal longer.
7. **Does this leak abstractions?** Consumers shouldn't see Effect/Layer/Context.

If you can't answer these clearly → **Keep internal, design more**

## Summary

**Expose through PlainServicesApi when:**
- Stable (1+ sprints of internal use)
- Needed by multiple extensions
- Promise-compatible (single result)
- Clear API surface

**Keep Effect-only when:**
- Experimental or evolving
- Internal implementation detail
- Requires streams/complex Effect patterns
- Too granular for typical consumers

**When in doubt:** Start internal, expose later. Public APIs are forever.
