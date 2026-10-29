# @salesforce/vscode-services-v2

Initial Effect **4.0.6** service contracts. Independent of the frozen V3
`@salesforce/vscode-services` package. Source compiles into the actual runtime keys
and public declarations; the packed-consumer gate tests this package, not substitute
fixture declarations.

Provides Connection/Alias/Config service keys, the org-ref key, org-state schemas,
and typed failures. No default layers, connections, caches, watchers, or runtime are
constructed here. Later migrated implementations provide these exact keys.

This does **not** claim production `api.v2` activation exists yet. W-24615046 adds
the V3 adapters; W-24615059 binds real connection/org instances; W-24615069 completes
the services surface; W-24615075 completes declaration/consumer integration. Registry
publication waits for the coordinated cutover, not this preparation PR.

Use V4 `ConnectionService.use(service => service.getConnection())` and
`SubscriptionRef.changes(ref)`. V3 static accessors and `ref.changes` do not exist here.
