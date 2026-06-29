# Effect Composition Style

How effects read, compose, and execute. Style preferences, not safety rules —
but they keep call sites flat and intent obvious. From real review decisions in
this repo.

## Core principle: an effect is a value you build flat, then run

An `Effect` is an immutable description, not executed work
([docs](https://effect.website/docs/getting-started/the-effect-type/)). Nothing
runs until a runner (`runPromise`/`runSync`/`yield*`). 3 consequences shape every
call site:

1. **Build the whole thing as one flat `.pipe` chain**, ops top-to-bottom.
2. **Make execution the terminal step**, not a wrapper around the expression.
3. **Bail conditions and dispatch are separate** — guard clauses up top, the pipe
   handles real variance.

Rest is application of these to specific combinators.

## Build effect as flat pipe, run it as terminal step

`pipe(value, f, g, h)` = `h(g(f(value)))`
([docs](https://effect.website/docs/getting-started/building-pipelines/#pipe)).
Make "run it" the last pipe entry instead of wrapping the whole expression in
`runPromise(...)`.

```typescript
// PREFERRED — flat: build effect, transform, then run as the final pipe step
await someEffect.pipe(
  Effect.tapError(error => Effect.logWarning('thing failed', { error })),
  Effect.ignore,
  getApexTestingRuntime().runPromise
);

// AVOID — extra nesting: the runner wraps the entire expression
await getApexTestingRuntime().runPromise(
  someEffect.pipe(
    Effect.tapError(error => Effect.logWarning('thing failed', { error })),
    Effect.ignore
  )
);
```

Identical behavior. First reads top-to-bottom as a pipeline ending in execution;
second forces paren-matching across the block to find the effect. Same logic for
any terminal combinator — `Effect.runFork`, a `provide` + run, etc.: put it last
in the pipe.

### Point-free terminal step safe ONLY when impl doesn't use `this`

3 cases:

- **Bare `Effect.runPromise` (standalone fn)** — always safe point-free; no
  receiver. `effect.pipe(..., Effect.runPromise)`.
- **`runtime.runPromise` (method)** — safe because `ManagedRuntime`'s
  `runPromise` is a closure over `self`, **not** `this` (effect
  `internal/managedRuntime.js` — `runPromise(effect, options)` uses
  `self.cachedRuntime`). Works regardless of receiver.
- **Arbitrary methods** — **don't blanket-apply.** Most VS Code API + class
  methods rely on `this`; passing `obj.method` as a callback detaches the
  receiver, breaks them. Verify the impl uses a captured closure var (not
  `this`) first. Unsure → keep explicit `x => obj.method(x)`.

Distinct from anti-patterns.md "Mixing Effect and Promise Chains": that bans the
`.then(...)` *after* the run, not the point-free run itself.
`effect.pipe(Effect.runPromise)` is fine; `effect.pipe(Effect.runPromise).then(...)`
is not.

## Keep side effects in the pipe with tap — including terminal ones

`Effect.tap` / `tapBoth` / `tapError` run a side effect **and pass the original
value through**. Use them for everything the pipe should do — logging, sentinels,
cache writes *between* transforms, **and** the terminal show-channel/fire-toast
at the end. The goal is one pipe that ends in execution: no imperative tail after
`yield*`/`await` re-inspecting the result.

```typescript
// PREFERRED — terminal notify stays in the pipe as a tap on the success value
return yield* runApexTests({ /* ... */ }).pipe(
  Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
  promptService.withCancellableProgress(executionName),
  Effect.tap(result =>
    Effect.sync(() => {
      OUTPUT_CHANNEL.show();
      (result === undefined
        ? notificationService.showFailedExecution
        : notificationService.showSuccessfulExecution)(executionName);
    })
  )
);

// AVOID — pull the result out, then branch imperatively below the pipe.
// Splits one operation across two reading modes (pipe + statements).
const result = yield* runApexTests({ /* ... */ }).pipe(/* ... */);
OUTPUT_CHANNEL.show();
(result === undefined ? /* ... */ : /* ... */)(executionName);
return result;
```

Wrap synchronous side effects in `Effect.sync` inside the tap. The `return yield*`
the whole pipe — don't bind to a local just to return it.

### Watch success-value vs failure-channel distinction

Before `tapBoth`/`tapError`, know which channel carries what. An effect resolving
to `undefined` on a soft failure is still on the **success** channel — `tapError`
won't see it. `tapBoth({ onFailure })` fires on *cancellation* too → spurious
"Failed" toast on dismiss. So branch on the resolved value inside a plain
`Effect.tap` (success channel): it sees the `undefined`-vs-value distinction and
never fires on cancellation, all while staying in the pipe.

## Match over nested ternaries for dispatch

Effect chosen among 3+ cases → nested ternary nests visually. Build with
`Match.value(...).pipe(Match.when(...), Match.orElse(...))` — each case one flat
line, then continue the same pipe into tap/ignore/run.

```typescript
await Match.value(single.id).pipe(
  Match.when(
    id => isClass(id) || isSuiteClass(id),
    () => CacheService.setCachedClassTestParam(getTestName(single))
  ),
  Match.when(isMethod, () => CacheService.setCachedMethodTestParam(getTestName(single))),
  Match.orElse(() => Effect.void),                 // the "neither" fallthrough
  Effect.tapError(error => Effect.logWarning('cache set failed', { error })),
  Effect.ignore,
  getApexTestingRuntime().runPromise
);
```

`Match.orElse(() => Effect.void)` = idiomatic no-op branch (replaces trailing
`: Effect.void` of a ternary).

### Keep prerequisite guards as early returns — don't fold into Match

Bail conditions (`if (isDebug || !single) return;`) aren't dispatch dimensions.
2 reasons to leave as guard clauses above the matcher:

1. **Narrowing.** Early `if (!single) return` refines `single` to non-`undefined`
   for every branch below → `getTestName(single)` type-checks without `!`.
   `Match.when(predicate, …)` with a boolean fn does **not** refine the matched
   type ([docs](https://effect.website/docs/code-style/pattern-matching/) — only
   literal/Schema discriminators narrow), so folding the guard in re-widens the
   value, forces non-null assertions.
2. **Separation of concerns.** "Should I run at all" (`isDebug`) is orthogonal to
   "which variant" (class vs method vs neither). Mixing
   `Match.when({ isDebug: true }, () => Effect.void)` into dispatch conflates the
   two.

Pattern: short-circuit prerequisites up top, matcher handles real variance on
proven-good input.

## Quick reference

| Situation | Do | Don't |
| --- | --- | --- |
| Build any multi-op effect | one flat `.pipe(...)` chain | nested `f(g(h(x)))` calls |
| Run a built effect | `effect.pipe(..., runtime.runPromise)` as last step | wrap whole expr in `runPromise(effect.pipe(...))` |
| Point-free terminal step | bare `Effect.runPromise` always; methods only when closure-based (e.g. `ManagedRuntime.runPromise`) | point-free any `this`-bound method |
| Any side effect (mid-pipe or terminal) | `Effect.tap` / `tapError` / `tapBoth`, value passes through | imperative tail after `yield*` re-inspecting the result |
| Sync side effect inside a tap | wrap in `Effect.sync(() => ...)` | — |
| Return the run's value | `return yield* effect.pipe(...)` | bind to a local just to `return` it |
| 3+ way effect dispatch | `Match.value().pipe(Match.when, Match.orElse)` | nested ternary |
| No-op Match branch | `Match.orElse(() => Effect.void)` | — |
| Prerequisite bail (`isDebug`, missing input) | early-return guard clause above the matcher | fold into `Match.when({...})` |
