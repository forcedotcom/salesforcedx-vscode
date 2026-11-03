---
name: effect-best-practices
description: Enforces Effect 4 patterns for services, errors, layers, atoms, and Effect.pipe composition. Use when writing Context.Service, Schema.TaggedError, Layer, effect-atom, Effect.fn/`.pipe`, or `yield*` pipelines.
review: always
version: 2.0.0
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
| Services          | `Context.Service` with explicit `Layer` composition       | V3 `Effect.Service` / `.Default` in V4 code                      |
| Dependencies      | Yield dependencies in `Layer.effect`; compose at boundary | Rebuild shared services at call sites                            |
| Errors            | `Schema.TaggedError` with `message` field                | Plain classes or generic Error                                   |
| Error Specificity | Split tags when catch arms or field shapes differ; telemetry dimensions are fields on one tag | Extra tags that all print `message` / fire the same span |
| Error Handling    | `catchTag`/`catchTags`; catch only when needed           | broad `Effect.catch`; swallowing; catching "just in case"        |
| IDs               | Salesforce record/org: `SalesforceId`/`OrgId` (`core/schemas/salesforceId.ts`). `DefaultOrgInfoSchema.orgId`/`devHubOrgId`: `Schema.optional(OrgId)` like `cliId`. Else `Schema.UUID.pipe(Schema.brand("@App/EntityId"))` | Plain `string`; `getAuthInfoFields().orgId` ad hoc; `optionalWith` as Option on DefaultOrgInfo |
| Functions         | `Effect.fn` for reusable traced functions; `Effect.gen` inline | Anonymous reusable generators; nested `Effect.gen` just to attach recovery |
| Composition       | `.pipe`; `local/inline-single-use-yield-binding` for yielded values; `local/no-standalone-pipeable-value` for Effect/Stream/Schema values. Details: `references/composition-style.md` | — |
| Params vs deps    | Params = runtime data; dependencies = yield from context | Passing Ref/PubSub/service as params                             |
| Naming            | `FooCommand` for commands, domain names for helpers      | `FooEffect` suffix (redundant; TS/Effect.fn already convey type) |
| Logging           | `Effect.log` with structured data                        | `console.log`                                                    |
| Config            | `Config.*` with validation                               | `process.env` directly (except build-time vars like `ESBUILD_*`) |
| Time values       | `Duration.seconds(30)`, `Duration.millis(5000)`; use `Duration.Input` for time parameters | Raw numeric milliseconds in Duration positions                   |
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

**Use `Context.Service`** for Effect 4 services. Define an explicit `Layer`; yield dependencies in its effect and compose layers at the application boundary.

```typescript
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

export class UserService extends Context.Service<
  UserService,
  { readonly findById: (id: UserId) => Effect.Effect<User, UserNotFoundError> }
>()('myapp/UserService') {
  static readonly layer = Layer.effect(
    UserService,
    Effect.gen(function* () {
      const repo = yield* UserRepo;
      return UserService.of({
        findById: Effect.fn('UserService.findById')(function* (id: UserId) {
          return yield* repo.findById(id);
        })
      });
    })
  ).pipe(Layer.provide(UserRepo.layer));
}

const MainLive = Layer.mergeAll(UserService.layer, OtherService.layer);
```

Use `Context.Service` for caller-provided interfaces too when several implementations are valid. Keep construction in the host/test layer; don't add a fake default implementation. `Context.Reference` is for a value-like service with a real default.

Use `Context.Service` for injectable interfaces, including caller-provided implementations. Keep `Context.Tag` only for third-party tags that must retain that API. See `references/service-patterns.md`.

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

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  'UserNotFoundError',
  {
    userId: UserId,
    message: Schema.String
  }
) {}

export class UserCreateError extends Schema.TaggedError<UserCreateError>()(
  'UserCreateError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String)
  }
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

Expected skip (missing optional plugin, incompatible version): write nls on the success path (guard / Match branch). `fail`+`catchTag` is for unexpected recovery — a handler that isn't "print this string."

Catch sparingly. Use `Effect.catch` only for deliberate recovery; use `catchTag`/`catchTags` when the failure is typed.

### Prefer Explicit Over Generic Errors

Split tags when **catch arms or field shapes** differ — e.g. `message`+`cause` vs `message`+`cause`+`setting`. Same catch work (print `message`, one span) → one tag; telemetry dimensions are fields, not tags. nls variance lives in `message`. Frontend/RPC still splits when the UI branches (`UserNotFoundError` vs `ChannelNotFoundError`). See `references/error-patterns.md`.

### Accumulating Errors Across a Collection

To **continue past failures** instead of short-circuiting on the first, don't hand-roll `Result` + `catchTag` + a re-loop. Use `Effect.partition` (both buckets), `Effect.validate` (all-or-nothing), or `Effect.validateFirst`. These recover the typed error channel per item but do NOT capture interruption — so a Cancel still aborts the whole loop.

See `references/error-patterns.md` for the accumulation/interruption nuance, error remapping, and retry patterns.

## Schema & Branded Types Pattern

**Brand all entity IDs** for type safety across service boundaries.

This repo — Salesforce record/org ids are not UUIDs. Use `SalesforceId`/`OrgId` and `orgIdFrom`/`orgIdFromConnection` (`getFields()` / Connection; `Option`; `references/schema-patterns.md`). Other AuthFields: `authFieldsFrom`/`authFieldsFromConnection`. `DefaultOrgInfoSchema.orgId`/`devHubOrgId`: `Schema.optional(OrgId)` like `cliId` — not Option.

```typescript
import { Schema } from 'effect';

// Entity IDs - always branded
export const UserId = Schema.UUID.pipe(Schema.brand('@App/UserId'));
export type UserId = Schema.Schema.Type<typeof UserId>;

export const TenantId = Schema.UUID.pipe(Schema.brand('@App/TenantId'));
export type TenantId = Schema.Schema.Type<typeof TenantId>;

// Domain types - use Schema.Struct
export const User = Schema.Struct({
  id: UserId,
  email: Schema.String,
  name: Schema.String,
  tenantId: TenantId,
  createdAt: Schema.DateTimeUtc
});
export type User = Schema.Schema.Type<typeof User>;

// Input types for mutations
export const CreateUserInput = Schema.Struct({
  email: Schema.String.pipe(Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))),
  name: Schema.NonEmptyString,
  tenantId: TenantId
});
export type CreateUserInput = Schema.Schema.Type<typeof CreateUserInput>;
```

**When NOT to brand:**

- Simple strings that don't cross service boundaries (URLs, file paths)
- Primitive config values

See `references/schema-patterns.md` for transforms and advanced patterns.

## Function Pattern: `Effect.fn` for reusable functions

Use `Effect.fn` for reusable traced functions; use `Effect.gen` for inline one-shot programs. Spanned `Effect.fn` requires a name (`local/require-effect-fn-span-name`). `Effect.tap` / `*SuccessNotification` middleware before catch middleware: `local/effect-fn-catch-middleware-last` (later catch and non-success guards stay valid). Details: services-extension-consumption Success handling.

Use `Effect.gen` for inline sequencing and service-layer construction. Don't wrap a single `yield*` only to make it pipeable; use the Effect itself or a named helper.

```typescript
// CORRECT - Effect.fn with descriptive name
const findById = Effect.fn('UserService.findById')(function* (id: UserId) {
  yield* Effect.annotateCurrentSpan('userId', id);
  return yield* repo.findById(id);
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

See `references/composition-style.md`: `.pipe`, `local/inline-single-use-yield-binding` for single-use yielded values, terminal runner, point-free safety, Match dispatch, guard clauses, recovery on a subsequence.

## Layer Composition

**Declare requirements in the service layer** and provide them at the composition boundary:

```typescript
// V4 service; the layer declares dependencies through its Effect requirements.
export class OrderService extends Context.Service<
  OrderService,
  { readonly placeOrder: (input: CreateOrderInput) => Effect.Effect<Order, OrderError> }
>()('myapp/OrderService') {
  static readonly layer = Layer.effect(
    OrderService,
    Effect.gen(function* () {
      const users = yield* UserService;
      const products = yield* ProductService;
      const payments = yield* PaymentService;
      return OrderService.of({
        placeOrder: Effect.fn('OrderService.placeOrder')(function* (input: CreateOrderInput) {
          const user = yield* users.findById(input.userId);
          const product = yield* products.findById(input.productId);
          return yield* payments.placeOrder(user, product, input);
        })
      });
    })
  ).pipe(Layer.provide(Layer.mergeAll(UserService.layer, ProductService.layer, PaymentService.layer)));
}

const AppLive = Layer.mergeAll(OrderService.layer, DatabaseLive, RedisLive);
```

See `references/layer-patterns.md` for testing layers and config-dependent layers.

### Effect-Owned Resources

Resources created inside an Effect service/layer belong to its scope. Prefer `scoped` plus
`Effect.addFinalizer` or `Effect.acquireRelease`; don't expose `dispose` or delegate cleanup to a host lifecycle.

```typescript
export class StatusService extends Context.Service<StatusService, { readonly show: Effect.Effect<void> }>()(
  'myapp/StatusService'
) {
  static readonly layer = Layer.effect(
    StatusService,
    Effect.gen(function* () {
      const item = vscode.window.createStatusBarItem();
      yield* Effect.addFinalizer(() => Effect.sync(() => item.dispose()));
      return StatusService.of({ show: Effect.sync(() => item.show()) });
    })
  );
}
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
| `T \| null \| undefined` | `isNullish` / `isNotNullish` |

```typescript
import * as Schema from 'effect/Schema';
import { isNotNull, isNotNullish, isNotUndefined, isNullish, isUndefined } from 'effect/Predicate';

// T | undefined — the common case (Optional<T>, optional props, ?? sources)
if (isUndefined(maybeValue)) return;
Effect.filterOrFail(isNotUndefined, () => new NotFoundError({ message: '...' }));

// non-id string that must be non-blank — not `isNotUndefined && length > 0`
Effect.filterOrFail(Schema.is(Schema.NonEmptyString), () => new NotFoundError({ message: '...' }));
// AuthFields org id: `orgIdFrom` / `orgIdFromConnection` → `Option<OrgId>`; fail-if-missing via `Option.match`
// DefaultOrgInfo orgId: already `OrgId | undefined` (`Schema.optional(OrgId)` like cliId)

// T | null — e.g. RegExp.exec, JSON payload fields
const match = scriptRegex.exec(html);
if (isNotNull(match)) { … }

// T | null | undefined — e.g. `exclude?: vscode.GlobPattern | null` (optional AND nullable)
const arr = isNullish(exclude) ? undefined : [exclude];
```

Runtime semantics: `isUndefined` is `x === undefined`, `isNull` is `x === null`, `isNullish`
is either. A wider guard than the type needs still compiles — it just implies a case the type
can't produce, so it reads as a lie about the value. Note `typeof x === 'object' && x !== null` object-narrowing stays as-is;
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

Works with any predicate — built-in (`isString`, `isError`, `isNotUndefined`, `isNotNullish`) or
custom. Only the wrapped predicate can be receiver-sensitive: `not(obj.method)`
detaches the receiver, so verify the impl uses no `this` first (see
[composition-style](./references/composition-style.md#point-free-terminal-step-safe-only-when-impl-doesnt-use-this)).

Keep `!` where the predicate isn't element-level (`!isCollectionType(decl.type)`)
unless a named element predicate already exists or is worth adding.

## Imports: Prefer Deep Imports from Effect modules

Use deep imports for Effect HTTP modules so bundles include only the implementation used.

**Always import the submodule as a namespace** (the submodule *is* the namespace — it has no self-named export):

```typescript
// CORRECT — deep namespace import, tree-shakes unused
import * as FetchHttpClient from 'effect/http/FetchHttpClient';
// use: FetchHttpClient.layer

// WRONG — import the whole HTTP namespace
import * as Http from 'effect/http';
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
import * as Schema from 'effect/Schema';

const config = Config.all({
  port: Config.Int('PORT').pipe(Config.withDefault(3000)),
  apiKey: Config.Redacted('API_KEY'),
  maxRetries: Config.schema(
    Schema.NumberFromString.pipe(Schema.check(Schema.isGreaterThan(0))),
    'MAX_RETRIES'
  )
});
```

See `references/observability-patterns.md` for metrics and tracing patterns.

## Reference Files

For detailed patterns, consult these reference files in the `references/` directory:

- `composition-style.md` - `.pipe`; `local/inline-single-use-yield-binding` for single-use yielded values; terminal runner; point-free safety; tap for side effects; Match dispatch; guard clauses; linear body as point-free pipe vs generator; recovery on a subsequence (pipe from the first Effect — not a nested `Effect.gen`)
- `service-patterns.md` - V4 `Context.Service`, Effect.fn, caller-provided interfaces
- `error-patterns.md` - Schema.TaggedError, error remapping, retry patterns
- `schema-patterns.md` - Branded types, transforms, Schema.Class
- `layer-patterns.md` - Dependency composition, testing layers
- `anti-patterns.md` - Complete list of forbidden patterns
- `diagnostics-findings.md` - Effect LS finding → fix, per rule
- `observability-patterns.md` - Logging, metrics, config patterns
