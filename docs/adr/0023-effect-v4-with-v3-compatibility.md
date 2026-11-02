# Effect V4 implementation, isolated V3 compatibility

Move first-party services, consumers and tooling to Effect V4 at `api.v2.services`; keep `api.services` as genuine V3 adapters for externally consumed contracts, backed by the same V4-owned connections, caches and org watchers.

Publish one `@salesforce/vscode-services` package: the unversioned root exposes the externally required V3 subset; `/v2` exposes V4 contracts. Use ordinary `effect` V4 plus `effect-v3` for legacy declarations. Root imports must not load V4; `/v2` must not expose V3 runnable values. Existing external consumers retain their V3 runtime. This supersedes the separate V4 declaration-package decision at the user's direction.

Keep the frozen full V3 declaration snapshot as a private transitional input while in-repo consumers migrate; do not break an intermediate stacked PR by prematurely removing their required members. Publish only the selected external root declaration properties, preserving their existing service identifiers. The final runtime cleanup removes remaining internal-only V3 members. [Migration plan](../architecture/effect-v4-migration.md) records ownership, dependency order and verification gates, including caller-owned schema decoding between physical V4 module copies.

## Considered Options

- Cast V4 Effects/Contexts/Layers/refs to V3: rejected; different runtimes, not compatible values.
- Keep complete V3 and V4 implementations: rejected; duplicate connections, caches, auth prompts and watchers.
- Require external consumers to upgrade: rejected; shipping Einstein and IAC interfaces must remain usable unchanged.
