# How far Effect/shared infra goes into a CLI-consumed library

A published, CLI-consumed library (first: `@salesforce/apex-node`, `packages/salesforcedx-apex`; `@salesforce/templates` likely next, TBD) MAY take `effect` and the spans-only observability surface as runtime `dependencies`, but MUST keep vscode-named infra — the [services API](./0008-services-sole-host-heavy-deps.md) (`@salesforce/vscode-services`), `@salesforce/effect-ext-utils`, and shared vscode i18n — out of its runtime deps (vscode-only; peer/dev at most). The split exists because these libs are plain npm packages consumed *transitively* by CLI plugins (plugin-apex, plugin-flow): every runtime `dependency` ships to each consumer, and the CLI has no services extension/runtime to route deps through the way vscode extensions do ([0008](./0008-services-sole-host-heavy-deps.md)).

## Considered Options

- **Full Effect + services, as vscode extensions do.** Rejected: there is no services runtime in `sf`, so the services API is unreachable from a CLI lib, and pulling vscode-named infra into runtime deps inflates the transitive dependency/install weight of every plugin consumer for code that cannot run.
- **Zero shared infra; keep the pre-Effect lib.** Rejected: blocks the dependent migrations ([0011](./0011-effect-ts-runtime.md) Effect runtime, [0012](./0012-spans-only-observability.md) spans-only observability, plus Effect-OTEL, HeapMonitor, streaming, residual-Effect, Effect-test, and shared-i18n work items that anchor on this decision).
- **Chosen middle.** `effect` core and the spans-only OTEL surface ([0012](./0012-spans-only-observability.md)) are allowed as runtime deps of the published lib; vscode-named infra (services API, effect-ext-utils, shared vscode i18n) stays out of runtime deps. Unlike vscode extensions, a CLI lib has no browser-target constraint ([0009](./0009-reduce-cli-deps-web-no-cli.md)) — but also no services host, so it carries its Effect surface directly rather than routing through services.

## Consequences

- Runtime deps added here flow transitively to every CLI consumer (plugin-apex, plugin-flow) and count toward their install/bundle weight; keep the runtime surface to `effect` + observability only.
- This is the boundary cited by the dependent work items above and by future CLI-lib migrations. `@salesforce/templates` is a separate npm package outside this monorepo — it cites this decision by ADR number/title ("vscode ADR-0021"), not by relative link.
- vscode-side guidance is unchanged: route heavy deps through the services API ([0008](./0008-services-sole-host-heavy-deps.md)). That path does not exist for CLI libs, which is the whole reason this ADR is separate.

See [ADR-FORMAT.md](../../.claude/skills/grill-me/ADR-FORMAT.md) and [README.md](./README.md).
