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
  Effect.tap(() => channelService.showChannel),
  Effect.tap(result =>
    Effect.sync(() => {
      (result === undefined
        ? notificationService.showFailedExecution
        : notificationService.showSuccessfulExecution)(executionName);
    })
  )
);

// AVOID — pull the result out, then branch imperatively below the pipe.
// Splits one operation across two reading modes (pipe + statements).
const result = yield* runApexTests({ /* ... */ }).pipe(/* ... */);
yield* channelService.showChannel;
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

## Linear body → point-free pipe, not a generator

Straight-line `Effect.fn` body — data in, one path out, no branching, no reused
intermediate — is a single point-free `pipe`. Reserve `function*` for **dependent**
`yield*`, branching, or early return.

Seed value already an `Effect`/`Tag` (e.g. a service accessor) → start with
`.pipe(...)` directly on it, same as every other example in this file. Only reach
for the standalone `pipe(value, ...)` import when the seed is a plain value (array,
string, parsed JSON) that isn't an Effect yet.

Any step that can throw (parsing, JSON, non-Effect FFI) must be lifted with
`Effect.try`/`Effect.tryPromise` — a bare throw inside the pipe's input becomes an
uncatchable `Die` defect, not a typed failure (`catchTag`/`catchAll` won't see it).
Same rule as "no throw inside Effect.gen" in `anti-patterns.md`, applied to
point-free pipes too.

```typescript
// PREFERRED — one pipe: constructors/array ops as steps, Effect.map for the tail
export const parseAndFilterUsers = Effect.fn('svc.parseAndFilterUsers')(
  (jsonText: string) =>
    Effect.try({ try: () => JSON.parse(jsonText), catch: cause => new JsonParseError({ cause }) }).pipe(
      Effect.map(Arr.filter(user => user.status === 'active')),
      Effect.map(Arr.map(user => user.id)),
      // data-last, point-free — the fn, not Arr.dedupe(xs)
      Effect.map(Arr.dedupe),
      Effect.map(Chunk.fromIterable)
    )
);

// GENERATOR — yield* to resolve a dependency, then run the stream pipe
export const fetchHeapDumpOverlayResults = Effect.fn('svc.fetchHeapDumpOverlayResults')(function* (
  logFileContents: string
) {
  // dependent yield*: resolve conn from ExtensionProviderService, then pipe
  const conn = yield* (yield* ExtensionProviderService).getServicesApi.pipe(
    Effect.flatMap(api => api.services.ConnectionService.getConnection())
  );
  return yield* pipe(
    extractHeapDumpIdsFromLog(logFileContents.split(/\r?\n/)),
    Arr.map(entry => entry.heapDumpId),
    Arr.dedupe,
    Stream.fromIterable,
    Stream.grouped(MAX_BATCH_SIZE),
    Stream.mapEffect(chunk => runOverlayBatch(conn, Chunk.toArray(chunk)), { concurrency: BATCH_API_CONCURRENCY }),
    Stream.flattenIterables,
    Stream.runCollect,
    Effect.map(Chunk.toArray)
  );
});

// AVOID — generator whose consts are each read once on the next line
export const fetchHeapDumpOverlayResults = Effect.fn('svc.fetchHeapDumpOverlayResults')(function* (
  conn: Connection,
  logFileContents: string
) {
  const uniqueIds = Arr.dedupe(extractHeapDumpIdsFromLog(logFileContents.split(/\r?\n/)).map(e => e.heapDumpId));
  const results = yield* Stream.fromIterable(uniqueIds).pipe(/* ...same ops... */, Stream.runCollect);
  return Chunk.toArray(results);
});
```

## Flatten nested pipes into sibling steps

A callback that itself calls `.pipe(...)` is a pipe inside a pipe — an indent that
makes the reader hold the outer combinator in mind while parsing the inner chain.
Prefer combinators as **siblings in one chain**. Two moves:

**1. Pure step feeding an effectful one → split `Effect.map` + `Effect.flatMap`.**
`x => pure(x).pipe(effectfulStep)` → pure part (array head, field pluck, `??`) its
own `Effect.map`; effectful part the next sibling, point-free. A data-last overload
(`(f) => (A) => Effect<B>`, e.g. `Effect.transposeMapOption`) is what makes the
`flatMap` arg point-free — no `x => …x` wrapper, no inner `.pipe`.

```typescript
// AVOID — flatMap callback opens a nested .pipe to head-then-decode
Effect.flatMap(result => Arr.head(result.records).pipe(Effect.transposeMapOption(decode)))
// PREFERRED — pure head as its own map, effectful decode as a sibling flatMap
Effect.map(result => Arr.head(result.records)),
Effect.flatMap(Effect.transposeMapOption(decode))
```

**2. Inner `.pipe(...)` that repeats verbatim at N≥2 sites → extract a parameterized
point-free helper**, varying bits as params. Call sites become the bare name;
nesting and duplication both go — and it closes gaps where one copy forgot a step
(e.g. `mapError`).

```typescript
const decodeOrFail = <A, I>(schema: Schema.Schema<A, I>, label: string) => (input: unknown) =>
  Schema.decodeUnknown(schema)(input).pipe(
    Effect.mapError((e: ParseResult.ParseError) =>
      new TraceFlagNotFoundError({ message: `Failed to decode ${label}: ${ParseResult.TreeFormatter.formatErrorSync(e)}` }))
  );
// call sites: records.map(decodeOrFail(Schema, 'trace flag records'))
```

**Threshold is reuse (N≥2), not nesting.** Single-use inner pipes and payloads stay
**inline** in their one pipe — extracting a single-use `const`/helper to "flatten"
just relocates it and adds indirection. Goal: one large pipe, no intermediate vars,
not a scatter of single-use helpers above it. And don't touch genuine multi-step
composition — a `Stream` inside `mapConcatEffect`, a branch with its own chain.
Target only nesting that **exists to sequence steps** or **repeats verbatim**.

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
| Linear `Effect.fn` body (data in, one path out) | single point-free `pipe`, constructors/array ops as steps, `Effect.map` for post-collect | `function*` with single-use `const x = yield*` then `return f(x)` |
| Point-free pipe seed | `.pipe(...)` on an existing Effect/Tag; standalone `pipe(value, ...)` only when the seed isn't an Effect yet | standalone `pipe(someEffect, ...)` when `someEffect.pipe(...)` works |
| Throwing step inside a point-free pipe (parse, FFI) | lift with `Effect.try`/`Effect.tryPromise` | bare `JSON.parse(...)`/throwing call as a pipe step |
| Callback does `pure(x).pipe(step)` | split: pure part as `Effect.map`, effectful part as sibling `Effect.flatMap` (point-free) | one `flatMap` whose callback opens a nested `.pipe` |
| Same `decode.pipe(mapError)` at N≥2 sites | extract parameterized point-free helper (`decodeOrFail(schema, label)`), call bare | copy the transform+error-remap into each site |
| Single-use inner pipe / payload | inline it in the one pipe (goal: one large pipe, no intermediate vars) | extract a single-use `const`/helper just to shorten the pipe |
| Nested pipe that only sequences steps | flatten to sibling steps | leave nesting that adds no branching |
| Nested pipe with real branching or its own `Stream`/sub-chain | keep nested — it's genuine composition | flatten mechanically and lose the structure |
