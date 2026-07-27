# Effect LS findings → fix

`config/effect-diagnostics.json` `enforcedRules` is the build gate (`npm run check:effect-diagnostics` fails on any listed rule, any severity). Fix unlisted findings too — each becomes enforced by a later WI.

| Rule | Finding | Fix |
| --- | --- | --- |
| `globalErrorInEffectFailure` / `globalErrorInEffectCatch` | `new Error(...)` in an E-channel position or a `try*` catch handler | `Schema.TaggedError` with a `message` field — see `anti-patterns.md` |
| `tryCatchInEffectGen` | `try`/`catch` inside `Effect.gen` | `catchTag`/`catchTags`; `catchAllCause` + `Cause.squash` when defects must be caught |
| `effectSucceedWithVoid` | `Effect.succeed(undefined)` | `Effect.void` |
| `unnecessaryFailYieldableError` | `yield* Effect.fail(err)` where `err` is already yieldable | `yield* err` |
| `effectFnIife` | immediately-invoked `Effect.fn` | `Effect.gen` + piped `Effect.withSpan` |
| `unnecessaryEffectGen` | `Effect.gen` whose whole body is one `yield* X` | `X`; `Effect.asVoid(X)` when the `yield*` isn't `return`ed and `X` isn't void. `Effect.fn` never matches — keep its span |
| `unnecessaryPipeChain` | chained `.pipe` on one expression: `x.pipe(a).pipe(b)` | 1 `pipe` with sibling steps: `x.pipe(a, b)`; drop steps the merge makes dead |
| `effectFnOpportunity` (not enforced) | `Effect.gen` where a named `Effect.fn` fits | `Effect.fn('Span')(function* …)` |
