# ComponentSetService

Build Salesforce component sets from source, manifests, or URIs. Accessor pattern: call methods directly.

## Methods

### getComponentSetFromProjectDirectories

Resolve all components in project package directories:

```typescript
const componentSet = yield * api.services.ComponentSetService.getComponentSetFromProjectDirectories();
```

Optional `include` filters by component type (ComponentSet wildcard members):

```typescript
const includeSet = new ComponentSet([
  { fullName: '*', type: 'LightningComponentBundle' },
  { fullName: '*', type: 'AuraDefinitionBundle' }
]);
const componentSet = yield * api.services.ComponentSetService.getComponentSetFromProjectDirectories({
  include: includeSet
});
```

When `include` omitted: returns all components. When provided: SDR narrows results to matching types only.

### getComponentSetFromManifest

Resolve components from manifest file:

```typescript
const manifestUri = /* ... */;
const componentSet = yield * api.services.ComponentSetService.getComponentSetFromManifest(manifestUri);
```

### getComponentSetFromUris

Resolve components from file/directory URIs (deduplicates):

```typescript
const uris = [uri1, uri2];
const componentSet = yield * api.services.ComponentSetService.getComponentSetFromUris(uris);
```

### buildComponentSet

Dispatch SourceSpec to appropriate getter (internal routing for deploy/retrieve):

```typescript
type SourceSpec =
  | { kind: 'paths'; uris: string[] }
  | { kind: 'manifest'; manifestUri: string }
  | { kind: 'projectDirectories' };

const componentSet = yield * api.services.ComponentSetService.buildComponentSet(spec);
```

Maps to `getComponentSetFromUris()`, `getComponentSetFromManifest()`, or `getComponentSetFromProjectDirectories()`. Use via `MetadataDeployService.deployFromSource()` / `MetadataRetrieveService.retrieveToSource()` — see [Metadata Deploy & Retrieve Services](metadata-deploy-retrieve-service.md).

### describeProjectComponents

Introspect components via owned `ComponentSetInfo` — no external SDR dependency:

```typescript
type ComponentInfo = {
  fullName: string;
  type: string;
  xmlPath?: string;
  contentPaths: string[];
};

type ComponentSetInfo = {
  size: number;
  sourceApiVersion?: string;
  projectDirectory?: string;
  components: ComponentInfo[];
  packageXml: string;
};

const info: ComponentSetInfo = yield * api.services.ComponentSetService.describeProjectComponents(spec);
```

Maps `SourceSpec` to owned types (no external imports). Consumers inspect `components[]`, `packageXml`, metadata without live ComponentSet. Use for tooling needing component visibility (LSP, project browser, metadata validation).

## Utilities

### ensureNonEmptyComponentSet

Validates ComponentSet is non-empty; errors if size=0 and no source components:

```typescript
const nonEmpty = yield * api.services.ComponentSetService.ensureNonEmptyComponentSet(componentSet);
```

Returns `NonEmptyComponentSet` branded type or throws `EmptyComponentSetError`.

### Component State & Status

```typescript
const { isSDRSuccess, isSDRFailure, getComponentState, makeFileResponseFailure, toRequestStatus } =
  yield * api.services.ComponentSetService;
```

Check deploy/retrieve outcome per component; map SDR response state to UI status.

## Errors

- `FailedToBuildComponentSetError` - Can't resolve from source/manifest/URIs
- `EmptyComponentSetError` - ComponentSet has no components (from ensureNonEmptyComponentSet)

## Notes

- Sets `projectDirectory`, `apiVersion`, `sourceApiVersion` on returned ComponentSet
- Requires `MetadataRegistryService`, `ProjectService`, `ConfigService`
- Uses registry access and SF project config for resolution
- Globally cached where applicable
