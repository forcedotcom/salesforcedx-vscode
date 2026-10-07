# Keep traditional and Effect APIs in one apex-node package

`@salesforce/apex-node` keeps its existing Promise/class API at the package root for compatibility and adds a pure Effect API for new development at `./effect`. Effect implementation, schemas, and errors live under `src/effect`. This work does not add parallel Promise facades or migrate existing classes. Both entry points remain in one package and version together.

Consumers choose the API by programming model, independently of host. Effect consumers compose `./effect` operations with explicit caller-selected connections and retain typed errors and Effect control flow. Existing consumers may continue to call the root Promise/class API. New Effect operations do not need matching root methods. A CLI command or VS Code extension may use either surface.

Serializable Effect wire and domain shapes use `Effect.Schema`. A schema is the source of truth for any matching public type, which is inferred with `Schema.Schema.Type`; `./effect` exports schema values and Effect operations. Existing root types, classes, and enums remain unchanged until an explicitly reviewed API change, following the package's [public API contract](./0004-public-api-contract.md) and [legacy subpath decision](./0001-deep-path-subpath-export.md).

The Effect implementation owns Apex behavior and accepts the connection selected by its consumer. It may use Effect and Effect Platform directly, but it must not depend on `@salesforce/vscode-services`; consumers may use their own layers to obtain the connection before passing it to an Apex operation. Extensions can obtain that connection through the [services API](../../../../docs/adr/0005-services-api-is-the-contract.md) and reuse its [prebuilt dependencies](../../../../docs/adr/0007-reuse-prebuilt-services-dependencies.md). This preserves services as the extension host for [heavy Salesforce dependencies](../../../../docs/adr/0008-services-sole-host-heavy-deps.md) without making a VS Code runtime mandatory for the published library.

Expected failures use `Schema.TaggedError` on Effect error channels, as required by the repository [error-channel decision](../../../../docs/adr/0004-effect-error-channels.md). Operations use `Effect.fn` spans under the [Effect runtime](../../../../docs/adr/0011-effect-ts-runtime.md) and [spans-only observability](../../../../docs/adr/0012-spans-only-observability.md) decisions.

The package keeps its existing Node filesystem contract and web-build substitution from [ADR 0003](./0003-node-filesystem-with-web-polyfill.md). Host selection remains a build/layer concern consistent with [in-process web libraries](../../../../docs/adr/0010-web-support-libs-in-process.md) and the [bundle-time platform split](../../../../docs/adr/0013-dual-target-bundle-time-split.md); this ADR adds no second filesystem abstraction.

This supersedes the direction proposed in closed [PR 7599](https://github.com/forcedotcom/salesforcedx-vscode/pull/7599), which framed apex-node as a CLI library allowed a limited Effect and observability subset. Apex-node instead owns the complete Effect API for its domain while remaining independent of VS Code runtime infrastructure; CLI and extension hosts select connections and other dependencies for its operations.

## Considered Options

- **Replace the root API with Effect.** Rejected because existing CLI and extension consumers require the established Promise/class surface.
- **Publish a separate Effect package.** Rejected because it would duplicate domain models, releases, compatibility checks, and implementation ownership.
- **Keep Effect internal with no `./effect` entry.** Rejected because Effect consumers would remain forced through Promise adapters and lose typed errors, interruption, scopes, streams, and layers.
- **Maintain schemas beside hand-authored matching types.** Rejected because the definitions can drift; matching types derive from schemas.
- **Depend on `@salesforce/vscode-services`.** Rejected because CLI consumers have no services extension host. VS Code consumers may depend on both packages and supply the selected connection to apex-node.

## Consequences

- Existing root consumers do not receive `Effect.Effect` return types or need to run Effects.
- `./effect` is a deliberate public API expansion covered by the JSON-schema contract, package-export test, and packed-consumer validation.
- Wire schemas decode untrusted transport and persisted data; domain schemas define normalized public values. Capability objects such as connections, streams, callbacks, and cancellation handles are not schema-modeled.
- The Effect API initially includes execute anonymous; log, test, coverage, streaming, reporter, and file behavior migrate in their respective work items.
- Existing Promise classes remain separate for now; Effect implementations must not call them.
