# Effect LS findings → fix

Repo's chosen fix per rule — the LS message and quickfix say what's wrong, this says what we do about it. Which rules gate the build is not tracked here: `config/effect-diagnostics.json` `enforcedRules` is the only list (`npm run check:effect-diagnostics` fails on any rule in it, any severity). Fix unlisted findings too — each becomes enforced by a later WI.

Many rules ship `default: "off"` upstream (`@effect/language-service/schema.json`) — an `off` rule reports nothing, so a name in `enforcedRules` gates nothing until `tsconfig.common.json` `diagnosticSeverity` pins it to `error`. Pinned there today: `floatingEffect`, `globalRandom`, `globalRandomInEffect`, `globalFetchInEffect`, `globalTimersInEffect`, `missedPipeableOpportunity`.

| Rule | Finding | Fix |
| --- | --- | --- |
| `globalErrorInEffectFailure` / `globalErrorInEffectCatch` | `new Error(...)` in an E-channel position or a `try*` catch handler | `Schema.TaggedError` with a `message` field — see `anti-patterns.md` |
| `tryCatchInEffectGen` | `try`/`catch` inside `Effect.gen` | `catchTag`/`catchTags`; `catchAllCause` + `Cause.squash` when defects must be caught |
| `effectSucceedWithVoid` | `Effect.succeed(undefined)` | `Effect.void` |
| `unnecessaryFailYieldableError` | `yield* Effect.fail(err)` where `err` is already yieldable | `yield* err` |
| `effectFnIife` | immediately-invoked `Effect.fn` | `Effect.gen` + piped `Effect.withSpan` |
| `unnecessaryEffectGen` | `Effect.gen` whose whole body is one `yield* X` | `X`; `Effect.asVoid(X)` when the `yield*` isn't `return`ed and `X` isn't void. `Effect.fn` never matches — keep its span |
| `unnecessaryPipeChain` | a pipe whose subject is itself a pipe, anywhere incl. inside a callback: `x.pipe(a).pipe(b)` or `pipe(pipe(x, a), b)` | 1 `pipe` with sibling steps: `x.pipe(a, b)`; drop steps the merge makes dead |
| `returnEffectInGen` | generator `return`s an Effect without `yield*` → `Effect<Effect<…>>` | `return yield* X` |
| `effectFnOpportunity` | `Effect.gen` where a named `Effect.fn` fits | `Effect.fn('Span')(function* …)` |
| `floatingEffect` | Effect expression statement never run | `yield*` it, or bind it |
| `globalRandom` / `globalRandomInEffect` | `Math.random()` (outside Effect / inside Effect) | `Random.next`, `Random.nextInt` |
| `globalFetchInEffect` | global `fetch(...)` inside Effect | `@effect/platform` `HttpClient` |
| `globalTimersInEffect` | `setTimeout`/`setInterval` inside Effect | `Effect.sleep`, `Effect.repeat`/`Effect.schedule` |
| `missedPipeableOpportunity` | nested Effect/Schema calls `f(g(pipeable))` — fires at ≥2 pipeable call-kind transformations | `pipeable.pipe(g, f)` — steps apply inner-first, so the terminal step (`runPromise`, `fork`, outer semaphore) lands last. Inner call a reused schema combinator (`Schema.optional(Schema.Array(x))`) → hoist a named `const` instead; the repo has 0 `X.pipe(Schema.optional)` sites. Never take the quickfix blind: it reflows to 4-space, collapses long chains, and moves preceding comments into the pipe's args |
