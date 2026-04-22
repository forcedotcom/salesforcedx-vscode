---
name: effect-best-practices
description: Enforces Effect-TS patterns for services, errors, layers, and atoms. Use when writing code with Effect.Service, Schema.TaggedError, Layer composition, or effect-atom React components.
version: 1.2.0
---

# Effect-TS Best Practices

This skill enforces opinionated, consistent patterns for Effect-TS codebases.

## Effect LS diagnostics (agent usage)

Cursor's `read_lints` does not surface Effect Language Server diagnostics. Use the CLI:

```bash
npx effect-language-service diagnostics --file <path>
# or whole project:
npx effect-language-service diagnostics --project tsconfig.json
```

- Run when editing Effect code; fix reported issues (e.g. `unnecessaryFailYieldableError` → yield error directly)
- `effect-language-service quickfixes` shows proposed code changes

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
| Options           | `Option.match` with both cases                           | `Option.getOrThrow`                                              |
| Nullability       | `Option<T>` in domain types                              | `null`/`undefined`                                               |
| Atoms             | `Atom.make` outside components                           | Creating atoms inside render                                     |
| Atom State        | `Atom.keepAlive` for global state                        | Forgetting keepAlive for persistent state                        |
| Atom Updates      | `useAtomSet` in React components                         | `Atom.update` imperatively from React                            |
| Atom Cleanup      | `get.addFinalizer()` for side effects                    | Missing cleanup for event listeners                              |
| Atom Results      | `Result.builder` with `onErrorTag`                       | Ignoring loading/error states                                    |

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

**Every distinct failure reason deserves its own error type.** Don't collapse multiple failure modes into generic HTTP errors.

```typescript
// WRONG - Generic errors lose information
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  'NotFoundError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

// Then mapping everything to it:
Effect.catchTags({
  UserNotFoundError: err => Effect.fail(new NotFoundError({ message: 'Not found' })),
  ChannelNotFoundError: err => Effect.fail(new NotFoundError({ message: 'Not found' })),
  MessageNotFoundError: err => Effect.fail(new NotFoundError({ message: 'Not found' }))
});
// Frontend gets useless: { _tag: "NotFoundError", message: "Not found" }
// Which resource? User? Channel? Message? Can't tell!
```

```typescript
// CORRECT - Explicit domain errors with rich context
export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  'UserNotFoundError',
  { userId: UserId, message: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class ChannelNotFoundError extends Schema.TaggedError<ChannelNotFoundError>()(
  'ChannelNotFoundError',
  { channelId: ChannelId, message: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class SessionExpiredError extends Schema.TaggedError<SessionExpiredError>()(
  'SessionExpiredError',
  { sessionId: SessionId, expiredAt: Schema.DateTimeUtc, message: Schema.String },
  HttpApiSchema.annotations({ status: 401 })
) {}

// Frontend can now show specific UI:
// - UserNotFoundError → "User doesn't exist"
// - ChannelNotFoundError → "Channel was deleted"
// - SessionExpiredError → "Your session expired. Please log in again."
```

See `references/error-patterns.md` for error remapping and retry patterns.

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

// Naming: Don't append Effect. For commands use FooCommand; for helpers/lifecycle use domain names.
// WRONG: logGetEffect, executeAnonymousDocumentEffect, activateEffect
// CORRECT: logGetCommand, executeAnonymousCommand, executeAnonymous (helper), activation (lifecycle)
```

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

Effect Atom provides reactive state management for React with Effect integration.

### Basic Atoms

```typescript
import { Atom } from '@effect-atom/atom-react';

// Define atoms OUTSIDE components
const countAtom = Atom.make(0);

// Use keepAlive for global state that should persist
const userPrefsAtom = Atom.make({ theme: 'dark' }).pipe(Atom.keepAlive);

// Atom families for per-entity state
const modalAtomFamily = Atom.family((type: string) => Atom.make({ isOpen: false }).pipe(Atom.keepAlive));
```

### React Integration

```typescript
import { useAtomValue, useAtomSet, useAtom, useAtomMount } from "@effect-atom/atom-react"

function Counter() {
    const count = useAtomValue(countAtom)           // Read only
    const setCount = useAtomSet(countAtom)          // Write only
    const [value, setValue] = useAtom(countAtom)    // Read + write

    return <button onClick={() => setCount((c) => c + 1)}>{count}</button>
}

// Mount side-effect atoms without reading value
function App() {
    useAtomMount(keyboardShortcutsAtom)
    return <>{children}</>
}
```

### Handling Results with Result.builder

**Use `Result.builder`** for rendering effectful atom results. It provides chainable error handling with `onErrorTag`:

```typescript
import { Result } from "@effect-atom/atom-react"

function UserProfile() {
    const userResult = useAtomValue(userAtom) // Result<User, Error>

    return Result.builder(userResult)
        .onInitial(() => <div>Loading...</div>)
        .onErrorTag("NotFoundError", () => <div>User not found</div>)
        .onError((error) => <div>Error: {error.message}</div>)
        .onSuccess((user) => <div>Hello, {user.name}</div>)
        .render()
}
```

### Atoms with Side Effects

```typescript
const scrollYAtom = Atom.make(get => {
  const onScroll = () => get.setSelf(window.scrollY);

  window.addEventListener('scroll', onScroll);
  get.addFinalizer(() => window.removeEventListener('scroll', onScroll)); // REQUIRED

  return window.scrollY;
}).pipe(Atom.keepAlive);
```

See `references/effect-atom-patterns.md` for complete patterns including families, localStorage, and anti-patterns.

## RPC & Cluster Patterns

For RPC contracts and cluster workflows, see:

- `references/rpc-cluster-patterns.md` - RpcGroup, Workflow.make, Activity patterns

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

## Anti-Patterns (Forbidden)

These patterns are **never acceptable**:

```typescript
// FORBIDDEN - runSync/runPromise inside services
const result = Effect.runSync(someEffect); // Never do this

// FORBIDDEN - throw inside Effect.gen
yield *
  Effect.gen(function* () {
    if (bad) throw new Error('No!'); // Use Effect.fail instead
  });

// FORBIDDEN - catchAll losing type info
yield * effect.pipe(Effect.catchAll(() => Effect.fail(new GenericError())));

// FORBIDDEN - swallowing errors (most errors surface to user; only catch when ignoring intentionally or providing better message)
yield * effect.pipe(Effect.catchAll(() => Effect.void));

// FORBIDDEN - console.log
console.log('debug'); // Use Effect.log

// FORBIDDEN - process.env directly (runtime config)
const key = process.env.API_KEY; // Use Config.string("API_KEY")

// EXCEPTION - build-time/bundle-time variables (e.g., ESBUILD_*)
const platform = process.env.ESBUILD_PLATFORM === 'web' ? webImpl : desktopImpl; // OK - build-time conditional

// FORBIDDEN - null/undefined in domain types
type User = { name: string | null }; // Use Option<string>
```

See `references/anti-patterns.md` for the complete list with rationale.

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

- `service-patterns.md` - Service definition, Effect.fn, Context.Tag exceptions
- `error-patterns.md` - Schema.TaggedError, error remapping, retry patterns
- `schema-patterns.md` - Branded types, transforms, Schema.Class
- `layer-patterns.md` - Dependency composition, testing layers
- `rpc-cluster-patterns.md` - RpcGroup, Workflow, Activity patterns
- `effect-atom-patterns.md` - Atom, families, React hooks, Result handling
- `anti-patterns.md` - Complete list of forbidden patterns
- `observability-patterns.md` - Logging, metrics, config patterns
