---
name: effect-best-practices
description: Enforces Effect-TS patterns for services, errors, layers, and atoms. Use when writing code with Effect.Service, Schema.TaggedError, Layer composition, or effect-atom React components.
review: always
version: 1.5.0
---

For diff/plan review against these patterns, invoke the `effect-advocate` subagent (`.claude/agents/effect-advocate.md`).

## Effect LS diagnostics (agent usage)

Cursor's `read_lints` does not surface Effect Language Server diagnostics. Use the CLI:

```bash
npx effect-language-service diagnostics --file <path>
# or whole project:
npx effect-language-service diagnostics --project tsconfig.json
```

- The PostToolUse `verify-on-edit.sh` hook auto-runs `--file <edited>` on every `.ts` Edit/Write and surfaces output as `followup_message`. Address what it reports.
- **Address warnings AND messages, not just errors.** `references/diagnostics-findings.md` maps each common finding to its fix; `config/effect-diagnostics.json` `enforcedRules` is the build gate.
- Enforcing a rule takes two edits, not just an `enforcedRules` entry — see `references/diagnostics-findings.md`.
- After a batch of edits, run `--project tsconfig.json` for the affected package to catch cross-file issues.
- `effect-language-service quickfixes` shows proposed code changes.

## Quick Reference: Critical Rules

| Category          | DO                                                       | DON'T                                                            |
| ----------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Services          | `Effect.Service` with `accessors: true`                  | `Context.Tag` for business logic                                 |
| Dependencies      | `dependencies: [Dep.Default]` in service                 | Manual `Layer.provide` at usage sites                            |
| Errors            | `Schema.TaggedError` with `message` field                | Plain classes or generic Error                                   |
| Error Specificity | `UserNotFoundError`, `SessionExpiredError`               | Generic `NotFoundError`, `BadRequestError`                       |
| Error Handling    | `catchTag`/`catchTags`; catch only when needed           | `catchAll`; swallowing; catching "just in case"                  |
| IDs               | `Schema.UUID.pipe(Schema.brand("@App/EntityId"))`        | Plain `string` for entity IDs                                    |
| Functions         | `Effect.fn` over `Effect.gen`; `.gen` only for shared pipes | Anonymous generators; `.gen` for business logic                   |
| Params vs deps    | Params = runtime data; dependencies = yield from context | Passing Ref/PubSub/service as params                             |
| Naming            | `FooCommand` for commands, domain names for helpers      | `FooEffect` suffix (redundant; TS/Effect.fn already convey type) |
| Logging           | `Effect.log` with structured data                        | `console.log`                                                    |
| Config            | `Config.*` with validation                               | `process.env` directly (except build-time vars like `ESBUILD_*`) |
| Time values       | `Duration.seconds(30)`, `Duration.millis(5000)`; params as `Duration.DurationInput` | Numeric milliseconds as `number` params or `TIMEOUT_MS = 30_000` constants |
| Options           | `Option.match` with both cases                           | `Option.getOrThrow`                                              |
| Nullability       | `Option<T>` in domain types                              | `null`/`undefined`                                               |
| Atoms             | `Atom.make` outside components                           | Creating atoms inside render                                     |
| Atom State        | `Atom.keepAlive` for global state                        | Forgetting keepAlive for persistent state                        |
| Atom Updates      | `useAtomSet` in React components                         | `Atom.update` imperatively from React                            |
| Atom Cleanup      | `get.addFinalizer()` for side effects                    | Missing cleanup for event listeners                              |
| Resource Cleanup  | Scoped service/layer + `Effect.addFinalizer`             | Returning `dispose`; delegating Effect-owned resources to callers |
| Atom Results      | `Result.builder` with `onErrorTag`                       | Ignoring loading/error states                                    |
| Grouping          | `Arr.groupBy` (effect/Array)                             | `Object.groupBy`, whose `Partial<Record>` forces a filter        |

## Service Definition Pattern

**Always use `Effect.Service`** for business logic services. This provides automatic accessors, built-in `Default` layer, and proper dependency declaration.

```typescript
import { Effect } from 'effect';

export class UserService extends Effect.Service<UserService>()('UserService', {
  accessors: true,
  dependencies: [UserRepo.Default, CacheService.Default],
  effect: Effect.gen(function* () {
    const repo = yield* UserRepo;
    const cache = yield* CacheService;

    const findById = Effect.fn('UserService.findById')(function* (id: UserId) {
      const cached = yield* cache.get(id);
      if (Option.isSome(cached)) return cached.value;

      const user = yield* repo.findById(id);
      yield* cache.set(id, user);
      return user;
    });

    const create = Effect.fn('UserService.create')(function* (data: CreateUserInput) {
      const user = yield* repo.create(data);
      yield* Effect.log('User created', { userId: user.id });
      return user;
    });

    return { findById, create };
  })
}) {}

// Usage - dependencies are already wired
const program = Effect.gen(function* () {
  const user = yield* UserService.findById(userId);
  return user;
});

// At app root
const MainLive = Layer.mergeAll(UserService.Default, OtherService.Default);
```

**When `Context.Tag` is acceptable:**

- Infrastructure with runtime injection (Cloudflare KV, worker bindings)
- Factory patterns where resources are provided externally
- Interfaces with caller-provided implementations — no single canonical one to bundle as `.Default` (e.g. `SoqlBuilderService`, implemented once by the VS Code host and once by a test fake); see `references/service-patterns.md`

### Params vs Dependencies

- **Params** = runtime data per call (IDs, user input, per-invocation config)
- **Dependencies** = shared infrastructure (Ref, PubSub, SubscriptionRef, services) — provide via layer, **yield inside** the effect
- Build Ref/PubSub/etc in the layer (e.g. `buildAllServicesLayer`); consumers yield them, don't receive as params

```typescript
// WRONG - passing shared infra as params
const createStatusBar = (pubsub: PubSub.PubSub<void>, stateRef: SubscriptionRef.SubscriptionRef<State>) =>
  Effect.gen(...)
// Caller must create and pass; wiring scattered at call sites

// CORRECT - yield inside, build in layer
const PubSubTag = Context.GenericTag<PubSub.PubSub<void>>("PubSub")
const createStatusBar = Effect.gen(function* () {
  const pubsub = yield* PubSubTag
  const stateRef = yield* StateRefTag
  // ...
})
// Layer: Layer.effect(PubSubTag, PubSub.sliding<void>(1))
```

See `references/service-patterns.md` for detailed patterns.

## Error Definition Pattern

**Always use `Schema.TaggedError`** for errors. This makes them serializable (required for RPC) and provides consistent structure.

```typescript
import { Schema } from 'effect';
import { HttpApiSchema } from '@effect/platform';

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  'UserNotFoundError',
  {
    userId: UserId,
    message: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class UserCreateError extends Schema.TaggedError<UserCreateError>()(
  'UserCreateError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String)
  },
  HttpApiSchema.annotations({ status: 400 })
) {}
```

**Error handling - use `catchTag`/`catchTags`:**

```typescript
// CORRECT - preserves type information
yield *
  repo.findById(id).pipe(
    Effect.catchTag('DatabaseError', err =>
      Effect.fail(new UserNotFoundError({ userId: id, message: 'Lookup failed' }))
    ),
    Effect.catchTag('ConnectionError', err =>
      Effect.fail(new ServiceUnavailableError({ message: 'Database unreachable' }))
    )
  );

// CORRECT - multiple tags at once
yield *
  effect.pipe(
    Effect.catchTags({
      DatabaseError: err => Effect.fail(new UserNotFoundError({ userId: id, message: err.message })),
      ValidationError: err => Effect.fail(new InvalidEmailError({ email: input.email, message: err.message }))
    })
  );
```

### When to Catch (and When Not To)

**Most errors surface to the user** (message/toast at runtime). Only catch when:

- **Genuinely ignore** – accept failure and continue (e.g. optional pre-create)
- **Better message** – default vague; map to clearer domain error

Catch sparingly. No `catchAll` or "swallow to be safe." Use `catchTag`/`catchTags`; log or fail with improved error.

### Prefer Explicit Over Generic Errors

**Every distinct failure reason deserves its own error type** with rich context (`userId`, `channelId`, `expiredAt`), not one generic `NotFoundError` everything maps to. A generic `{ _tag: 'NotFoundError', message: 'Not found' }` can't tell the frontend which resource failed or how to recover; explicit tags drive specific UI. See `references/error-patterns.md` for the WRONG/CORRECT contrast and naming conventions.

### Accumulating Errors Across a Collection

To **continue past failures** instead of short-circuiting on the first, don't hand-roll `Either` + `catchTag` + a re-loop. Use `Effect.partition` (both buckets), `Effect.validateAll` (all-or-nothing), or `Effect.validateFirst`. These recover the typed error channel per item but do NOT capture interruption — so a Cancel still aborts the whole loop.

See `references/error-patterns.md` for the accumulation/interruption nuance, error remapping, and retry patterns.

## Schema & Branded Types Pattern

**Brand all entity IDs** for type safety across service boundaries:

```typescript
import { Schema } from 'effect';

// Entity IDs - always branded
export const UserId = Schema.UUID.pipe(Schema.brand('@App/UserId'));
export type UserId = Schema.Schema.Type<typeof UserId>;

export const OrganizationId = Schema.UUID.pipe(Schema.brand('@App/OrganizationId'));
export type OrganizationId = Schema.Schema.Type<typeof OrganizationId>;

// Domain types - use Schema.Struct
export const User = Schema.Struct({
  id: UserId,
  email: Schema.String,
  name: Schema.String,
  organizationId: OrganizationId,
  createdAt: Schema.DateTimeUtc
});
export type User = Schema.Schema.Type<typeof User>;

// Input types for mutations
export const CreateUserInput = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  name: Schema.String.pipe(Schema.minLength(1)),
  organizationId: OrganizationId
});
export type CreateUserInput = Schema.Schema.Type<typeof CreateUserInput>;
```

**When NOT to brand:**

- Simple strings that don't cross service boundaries (URLs, file paths)
- Primitive config values

See `references/schema-patterns.md` for transforms and advanced patterns.

## Function Pattern: Prefer Effect.fn over Effect.gen

**Prefer `Effect.fn`** for effectful code. Provides automatic tracing with proper span names. Span name required; enforced by `local/require-effect-fn-span-name`.

**Use `Effect.gen` only when** you need a shared effect with common `.pipe` attached so multiple consumers don't each pipe the same things — e.g. provided dependencies, common error handlers, retries. (Less common with Runtimes.) Service definition bodies are a valid use (shared wiring).

```typescript
// CORRECT - Effect.fn with descriptive name
const findById = Effect.fn('UserService.findById')(function* (id: UserId) {
  yield* Effect.annotateCurrentSpan('userId', id);
  const user = yield* repo.findById(id);
  return user;
});

// CORRECT - Effect.fn with multiple parameters
const transfer = Effect.fn('AccountService.transfer')(function* (fromId: AccountId, toId: AccountId, amount: number) {
  yield* Effect.annotateCurrentSpan('fromId', fromId);
  yield* Effect.annotateCurrentSpan('toId', toId);
  yield* Effect.annotateCurrentSpan('amount', amount);
  // ...
});

// WRONG - params on wrapper arrow, generator has none (closure capture)
// Enforced by local/no-effect-fn-wrapper
const findByIdBad = (id: UserId) =>
  Effect.fn('UserService.findById')(function* () {
    yield* repo.findById(id); // id from closure
  });

// WRONG - Effect.fn invoked immediately (config-enforced effectFnIife). Effect.fn builds a reusable
// function; for one-shot use write Effect.gen and keep the span with a piped withSpan.
const opened = Effect.fn('FsService.open')(function* () {
  yield* fs.showTextDocument(uri);
})();
// CORRECT
const openedOk = Effect.gen(function* () {
  yield* fs.showTextDocument(uri);
}).pipe(Effect.withSpan('FsService.open'));

// Naming: Don't append Effect. For commands use FooCommand; for helpers/lifecycle use domain names.
// WRONG: logGetEffect, executeAnonymousDocumentEffect, activateEffect
// CORRECT: logGetCommand, executeAnonymousCommand, executeAnonymous (helper), activation (lifecycle)
```

See `references/composition-style.md` for how to compose these: flat build-then-run pipes, terminal runner, point-free safety, Match dispatch, guard clauses.

## Layer Composition

**Declare dependencies in the service**, not at usage sites:

```typescript
// CORRECT - dependencies in service definition
export class OrderService extends Effect.Service<OrderService>()('OrderService', {
  accessors: true,
  dependencies: [UserService.Default, ProductService.Default, PaymentService.Default],
  effect: Effect.gen(function* () {
    const users = yield* UserService;
    const products = yield* ProductService;
    const payments = yield* PaymentService;
    // ...
  })
}) {}

// At app root - simple merge
const AppLive = Layer.mergeAll(
  OrderService.Default,
  // Infrastructure layers (intentionally not in dependencies)
  DatabaseLive,
  RedisLive
);
```

See `references/layer-patterns.md` for testing layers and config-dependent layers.

### Effect-Owned Resources

Resources created inside an Effect service/layer belong to its scope. Prefer `scoped` plus
`Effect.addFinalizer` or `Effect.acquireRelease`; don't expose `dispose` or delegate cleanup to a host lifecycle.

```typescript
export class StatusService extends Effect.Service<StatusService>()('StatusService', {
  accessors: true,
  scoped: Effect.gen(function* () {
    const item = vscode.window.createStatusBarItem();
    yield* Effect.addFinalizer(() => Effect.sync(() => item.dispose()));
    return { show: Effect.sync(() => item.show()) };
  })
}) {}
```

The layer owner must close its scope. A `ManagedRuntime` owns its layers' scopes; dispose it during extension
deactivation. Use `context.subscriptions` only for resources created outside Effect ownership.

## Option Handling

**Never use `Option.getOrThrow`**. Always handle both cases explicitly:

```typescript
// CORRECT - explicit handling
yield *
  Option.match(maybeUser, {
    onNone: () => Effect.fail(new UserNotFoundError({ userId, message: 'Not found' })),
    onSome: user => Effect.succeed(user)
  });

// CORRECT - with getOrElse for defaults
const name = Option.getOrElse(maybeName, () => 'Anonymous');

// CORRECT - Option.map for transformations
const upperName = Option.map(maybeName, n => n.toUpperCase());
```

## Effect Atom (Frontend State)

Reactive React state via `@effect-atom/atom-react`. Define atoms OUTSIDE components; `keepAlive` for state that must persist; `useAtomSet` to write; `Result.builder` to render effectful results; `get.addFinalizer` to clean up listeners.

```typescript
import { Atom, Result, useAtomValue, useAtomSet } from '@effect-atom/atom-react';

const countAtom = Atom.make(0); // outside the component
const prefsAtom = Atom.make({ theme: 'dark' }).pipe(Atom.keepAlive); // persistent

function Counter() {
  const count = useAtomValue(countAtom);
  const setCount = useAtomSet(countAtom);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// Effectful atom → Result; handle loading/error/success
function UserProfile() {
  return Result.builder(useAtomValue(userAtom))
    .onInitial(() => <div>Loading...</div>)
    .onErrorTag('NotFoundError', () => <div>User not found</div>)
    .onError(error => <div>Error: {error.message}</div>)
    .onSuccess(user => <div>Hello, {user.name}</div>)
    .render();
}
```

See `references/effect-atom-patterns.md` for families, React hooks, side-effect atoms with finalizers, localStorage, and anti-patterns.

## SubscriptionRef

`SubscriptionRef<A>` is a mutable ref whose `.changes` stream **always emits the current value as element 0**, then all future mutations.

Implemented as (from `effect/src/internal/subscriptionRef.ts`):
```ts
stream.concat(stream.make(currentValue), stream.fromPubSub(pubsub))
```
The `Ref.get` + pubsub subscription happen atomically under a semaphore — no events are missed.

```typescript
// WRONG — prepended get is always redundant
Stream.concat(Stream.fromEffect(SubscriptionRef.get(ref)), ref.changes)
Stream.concat(Stream.make(yield* SubscriptionRef.get(ref)), ref.changes)
Stream.merge(Stream.fromEffect(SubscriptionRef.get(ref)), ref.changes)

// CORRECT — .changes already provides the snapshot
ref.changes.pipe(...)
```

To skip the initial snapshot (e.g. avoid a spurious refresh on activation), use `Stream.drop(1)`.

## Grouping

`Object.groupBy` is typed `Partial<Record<K, V[]>>`, so every consumer filters or defaults the `undefined`. `Arr.groupBy` returns `Record<K, NonEmptyArray<V>>` — total, so `Object.entries` needs no guard.

```typescript
import * as Arr from 'effect/Array';

const grouped = Arr.groupBy(ids, id => id.slice(0, 3)); // Record<string, NonEmptyArray<string>>
Object.entries(grouped).map(([prefix, group]) => query(prefix, group));

// vs Object.groupBy, where the same line needs:
//   .filter((entry): entry is [string, string[]] => isNotUndefined(entry[1]))
```

Keep `Object.groupBy` only when the `Partial` is load-bearing — e.g. destructuring absent keys with defaults, `const { deploys = [], deleted = [] } = ...`.

## Anti-Patterns (Forbidden)

The DON'T column above names each forbidden pattern. `references/anti-patterns.md`
has the complete list — each with rationale and the correct alternative.

## Emptiness Guards: match the declared type

`== null` / `!= null` are banned in effect packages (`noNullCompare` in `eslint.config.mjs`).
Pick the `effect/Predicate` guard by what the declared type actually admits — one guard per
union shape, no exceptions:

| declared type          | guard                      |
| ---------------------- | -------------------------- |
| `T \| undefined`       | `isUndefined` / `isNotUndefined` |
| `T \| null`            | `isNull` / `isNotNull`     |
| `T \| null \| undefined` | `isNullable` / `isNotNullable` |

```typescript
import { isNotNull, isNotUndefined, isNullable, isUndefined } from 'effect/Predicate';

// T | undefined — the common case (Optional<T>, optional props, ?? sources)
if (isUndefined(maybeValue)) return;
Effect.filterOrFail(isNotUndefined, () => new NotFoundError({ message: '...' }));

// T | null — e.g. RegExp.exec, JSON payload fields
const match = scriptRegex.exec(html);
if (isNotNull(match)) { … }

// T | null | undefined — e.g. `exclude?: vscode.GlobPattern | null` (optional AND nullable)
const arr = isNullable(exclude) ? undefined : [exclude];
```

Runtime semantics: `isUndefined` is `x === undefined`, `isNull` is `x === null`, `isNullable`
is either (`node_modules/effect/src/Predicate.ts:611,649,925`). A wider guard than the type
needs still compiles — it just implies a case the type can't produce, so it reads as a lie
about the value. Note `typeof x === 'object' && x !== null` object-narrowing stays as-is;
that's a structural check, not an emptiness check.

## Point-free Predicates in Filters

Use `Predicate.not()` for filter negations; combines point-free and readability.

```typescript
import { not } from 'effect/Predicate';

// CORRECT — point-free negation
arr.filter(not(isFlowTest))

// AVOID — arrow wrapper around negation
arr.filter(x => !isFlowTest(x))
```

Works with any predicate — built-in (`isString`, `isError`, `isNotUndefined`, `isNotNullable`) or
custom. Only the wrapped predicate can be receiver-sensitive: `not(obj.method)`
detaches the receiver, so verify the impl uses no `this` first (see
[composition-style](./references/composition-style.md#point-free-terminal-step-safe-only-when-impl-doesnt-use-this)).

Keep `!` where the predicate isn't element-level (`!isCollectionType(decl.type)`)
unless a named element predicate already exists or is worth adding.

## Imports: Prefer Deep Imports from @effect/platform

Barrel imports from `@effect/platform` bundle HttpApiSwagger (Swagger UI), which esbuild cannot tree-shake. This bloats web/desktop bundles by ~5.5MB per output and can trigger security scanner false positives (e.g., ClamAV signatures).

**Always import the submodule as a namespace** (the submodule *is* the namespace — it has no self-named export):

```typescript
// CORRECT — deep namespace import, tree-shakes unused
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
// use: FetchHttpClient.layer

// WRONG — barrel import drags in HttpApiSwagger
import { FetchHttpClient } from '@effect/platform';
```

Matches the repo's `import * as Effect from 'effect/Effect'` style. Applies to all `@effect/*` packages. Check import source before committing.

## Observability

```typescript
// Structured logging
yield * Effect.log('Processing order', { orderId, userId, amount });

// Metrics
const orderCounter = Metric.counter('orders_processed');
yield * Metric.increment(orderCounter);

// Config with validation
const config = Config.all({
  port: Config.integer('PORT').pipe(Config.withDefault(3000)),
  apiKey: Config.secret('API_KEY'),
  maxRetries: Config.integer('MAX_RETRIES').pipe(
    Config.validate({ message: 'Must be positive', validation: n => n > 0 })
  )
});
```

See `references/observability-patterns.md` for metrics and tracing patterns.

## Reference Files

For detailed patterns, consult these reference files in the `references/` directory:

- `composition-style.md` - Effects as flat build-then-run pipes: terminal runner, point-free safety, keep side effects (even terminal) in tap, Match dispatch, guard clauses, linear body as point-free pipe vs generator
- `service-patterns.md` - Service definition, Effect.fn, Context.Tag exceptions
- `error-patterns.md` - Schema.TaggedError, error remapping, retry patterns
- `schema-patterns.md` - Branded types, transforms, Schema.Class
- `layer-patterns.md` - Dependency composition, testing layers
- `rpc-cluster-patterns.md` - RpcGroup, Workflow, Activity patterns
- `effect-atom-patterns.md` - Atom, families, React hooks, Result handling
- `anti-patterns.md` - Complete list of forbidden patterns
- `diagnostics-findings.md` - Effect LS finding → fix, per rule
- `observability-patterns.md` - Logging, metrics, config patterns
