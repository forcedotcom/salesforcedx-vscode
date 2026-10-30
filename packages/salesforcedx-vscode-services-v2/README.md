# @salesforce/vscode-services-v2

This package provides Effect **4.0.6** service contracts, independent of the frozen V3
`@salesforce/vscode-services` package. Source compiles into the actual runtime keys
and public declarations; the packed-consumer gate tests this package, not substitute
fixture declarations.

The 23 canonical public keys cover Connection/Alias/Config, Workspace/Settings/FS,
Channel/watchers/PubSubs, Project/Registry/SourceTracking, metadata describe,
ComponentSet/nonmerge retrieval, query, Transmogrifier, catalog and active-operation
state. The package also exports URI codecs, org/session and artifact schemas, and
typed failures. It constructs no default layers, connections, caches, watchers, or
runtime. The isolated V4 implementations provide these exact keys; the owning
runtime selects only the public keys for the prebuilt Context and Layer.

The pure `/uriComparison` subpath includes containment helpers and is safe to share
with V3 code because it carries no Effect values. Its CommonJS artifacts also
support existing Node16 declaration consumers. VS Code typings use a compatible
peer range so consumers retain one ambient declaration version rather than
conflicting nested copies.

This does **not** claim production `api.v2` activation exists yet. W-24615046 adds
the V3 adapters; W-24615059 binds real connection/org instances; W-24615060 adds the
[project/catalog graph and document provider](../../docs/architecture/effect-v4-project-catalog.md);
W-24615069 completes the services surface; W-24615075 completes declaration/consumer
integration. Registry publication waits for the coordinated cutover.

Use V4 `ConnectionService.use(service => service.getConnection())` and
`SubscriptionRef.changes(ref)`. V3 static accessors and `ref.changes` do not exist here.
