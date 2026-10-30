# V4 services implementation staging

This private package contains the migrated service implementations while the
services extension still runs its V3 production graph. It uses ordinary Effect
4.0.6 and the canonical keys from `@salesforce/vscode-services-v2`.

The foundation, connection, project and catalog layers are stable values, not
runtime factories. Dependent slices must compose those same values so caches,
references, watchers and the scoped default output channel remain shared.
`catalogProviderLayers` includes catalog readers/stores, SourceTracking, merged
retrieve/deploy/delete, Lightning bundle rename and the text document provider.
`createCatalogRuntime` delegates to the existing connection runtime owner and
selects the 26 canonical public keys for its prebuilt Context.
The host supplies its existing web filesystem provider getter, connection host
values and localized catalog/metadata-operation messages. Foundation-only watcher composition still
requires ChannelService explicitly.

W-24615069 moves these implementations into the provider and removes this temporary
package and the superseded V3 implementations. Do not activate a second production
graph. See the [foundation](../../docs/architecture/effect-v4-foundations.md),
[connection](../../docs/architecture/effect-v4-connection.md) and
[project/catalog](../../docs/architecture/effect-v4-project-catalog.md) and
[metadata operations](../../docs/architecture/effect-v4-metadata-operations.md)
contracts for ownership, platform behavior and verification boundaries.
