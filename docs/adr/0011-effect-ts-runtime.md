# Effect-TS is the async + DI + error + observability runtime

New code uses Effect-TS as the single runtime for async, dependency injection, error handling, and observability: services as `Effect.Service` with `accessors: true`, composed via Layers, and `Effect.fn('Span')` for traced operations. This is the umbrella decision under which the [error-channel](./0004-effect-error-channels.md) and [spans-only observability](./0012-spans-only-observability.md) ADRs sit. See [effect-best-practices](../../.claude/skills/effect-best-practices/SKILL.md).
