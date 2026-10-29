# Effect V4 implementation, isolated V3 compatibility

Move first-party services, consumers and tooling to Effect V4 at `api.v2.services`; keep `api.services` as genuine V3 adapters for externally consumed contracts, backed by the same V4-owned connections, caches and org watchers. Publish legacy V3 declarations in the existing `@salesforce/vscode-services` package and V4 declarations in a separate `@salesforce/vscode-services-v2` package, so existing consumers neither install V4 nor migrate their runtimes. [Migration plan](../architecture/effect-v4-migration.md) records the audited contracts, ownership, dependency order and verification gates.

## Considered Options

- Cast V4 Effects/Contexts/Layers/refs to V3: rejected; different runtimes, not compatible values.
- Keep complete V3 and V4 implementations: rejected; duplicate connections, caches, auth prompts and watchers.
- Require external consumers to upgrade: rejected; shipping Einstein and IAC interfaces must remain usable unchanged.
