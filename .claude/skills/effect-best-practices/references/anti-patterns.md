# Anti-Patterns (Forbidden)

These patterns are **never acceptable** in Effect-TS code. Each is listed with rationale and the correct alternative.

## FORBIDDEN: Effect.run* Inside Effect Context

Enforced by Effect LS rule `runEffectInsideEffect` (in `config/effect-diagnostics.json` `enforcedRules`; build fails on any hit). Breaks composition, loses error handling/tracing.

Direct-in-gen: `yield*` instead of `Effect.run*`. In a vscode callback: capture `const runtime = yield* Effect.runtime()` in the enclosing gen, then `Runtime.run*(runtime)(...)` — keep the original method (`runSync`/`runPromise`/`runFork`), never downgrade to fire-and-forget. Pattern ref: `packages/salesforcedx-vscode-services/src/core/lifecycleWarningListener.ts`.

## FORBIDDEN: Global Error in Effect Failure Channel / Catch Handler

Enforced by Effect LS rules `globalErrorInEffectFailure` + `globalErrorInEffectCatch` (in `config/effect-diagnostics.json` `enforcedRules`; build fails on any hit). A `new Error(...)` in an E-channel position — a failure channel or catch callback whose result flows to `E` (`Effect.fail`, `Effect.async<A, Error>`, `Effect.catch`, `Stream.fromAsyncIterable` error map), caught by `globalErrorInEffectFailure` — or in a `try*` catch handler (`tryPromise`/`try`/`tryMap`/`tryMapPromise` `catch`), caught by `globalErrorInEffectCatch`, can't be discriminated by `catchTag`. Use a `Schema.TaggedError` with a `message` field (colocate module-local; export only when it crosses a package `.d.ts` boundary — see `ts4023-effect-errors`).

## FORBIDDEN: throw Inside Effect.gen

```typescript
// FORBIDDEN
yield* Effect.gen(function* () {
    const user = yield* repo.findById(id)
    if (!user) {
        throw new Error("User not found") // Bypasses Effect error channel
    }
    return user
})
```

**Why:** Throws bypass Effect's error channel, can't be caught with `catchTag`, breaks type safety.

**Correct:**
```typescript
yield* Effect.gen(function* () {
    const user = yield* repo.findById(id)
    if (!user) {
        return yield* Effect.fail(new UserNotFoundError({ userId: id, message: "Not found" }))
    }
    return user
})
```

`try/catch` inside `Effect.gen` is equally forbidden — enforced by LS rule `tryCatchInEffectGen` (config-enforced). Catches thrown JS; misses failures/defects in the Effect error channel. Correct: `catchTag`/`catchTags` for typed errors; `Effect.catchCause` when defects must be caught too; `Effect.try`/`tryPromise` to wrap throwing sync/async at the boundary.

## FORBIDDEN: Broad catch Losing Type Information

```typescript
// FORBIDDEN
yield* someEffect.pipe(
    Effect.catch((err) =>
        Effect.fail(new GenericError({ message: "Something failed" }))
    )
)
```

**Why:** Loses specific error information, makes debugging harder, prevents specific error handling downstream.

**Correct:**
```typescript
yield* someEffect.pipe(
    Effect.catchTags({
        DatabaseError: (err) => Effect.fail(new ServiceUnavailableError({ message: err.message })),
        ValidationError: (err) => Effect.fail(new BadRequestError({ message: err.message })),
    }),
)
```

## FORBIDDEN: any/unknown Casts

```typescript
// FORBIDDEN
const data = someValue as any
const result = (await fetch(url)) as unknown as MyType
```

**Why:** Completely bypasses type safety, can cause runtime errors, loses Effect's type guarantees.

**Correct:**
```typescript
// Use Schema for parsing unknown data
const result = yield* Schema.decodeUnknownEffect(MyType)(someValue)

// Or explicit type guards
if (isMyType(someValue)) {
    // Now safely typed
}
```

## FORBIDDEN: Accessing _tag Directly

```typescript
// FORBIDDEN
telemetryService.sendException(APEX_LSP_ORPHAN, error._tag)
const msg = `Error: ${error._tag}`
```

**Why:** `_tag` is internal; Shape can change. Use error-specific fields or String() conversion.

**Correct:**
```typescript
// Use String() for generic error messages
telemetryService.sendException(APEX_LSP_ORPHAN, String(error))

// Or extract error-specific fields
telemetryService.sendException(APEX_LSP_ORPHAN, error.message)
```

## FORBIDDEN: Promise in Service Signatures

```typescript
// FORBIDDEN
export class UserService extends Context.Service<UserService, {
    readonly findById: (id: UserId) => Effect.Effect<User, UserNotFoundError>
}>()("myapp/UserService") {}

// WRONG: a Promise-returning implementation does not satisfy the service contract.
const findById = async (id: UserId): Promise<User> => getUserFromDatabase(id)
```

**Why:** Loses Effect's error handling, can't compose with other Effects, loses tracing/metrics.

**Correct:**
```typescript
const findById = Effect.fn("UserService.findById")(
    function* (id: UserId) {
        // ...
    }
)
```

## FORBIDDEN: console.log

```typescript
// FORBIDDEN
console.log("Processing order:", orderId)
console.error("Error:", error)
```

**Why:** Not structured, not captured by Effect's logging system, lost in production telemetry.

**Correct:**
```typescript
yield* Effect.log("Processing order", { orderId })
yield* Effect.logError("Operation failed", { error: String(error) })
```

## FORBIDDEN: process.env Directly

```typescript
// FORBIDDEN
const apiKey = process.env.API_KEY
const port = parseInt(process.env.PORT || "3000")
```

**Why:** No validation, no type safety, fails silently if missing, hard to test.

**Correct:**
```typescript
const config = yield* Config.all({
    apiKey: Config.Redacted("API_KEY"),
    port: Config.Int("PORT").pipe(Config.withDefault(3000)),
})
```

## FORBIDDEN: null/undefined in Domain Types

```typescript
// FORBIDDEN
type User = {
    name: string
    bio: string | null
    avatar: string | undefined
}
```

**Why:** Null/undefined handling is error-prone, loses the explicit "absence" semantics.

**Correct:**
```typescript
const User = Schema.Struct({
    name: Schema.String,
    // Wire null/absence becomes an explicit Option at the boundary.
    bio: Schema.OptionFromNullishOr(Schema.String),
    avatar: Schema.OptionFromUndefinedOr(Schema.String),
})
```

## FORBIDDEN: Option.getOrThrow

```typescript
// FORBIDDEN
const user = Option.getOrThrow(maybeUser)
const name = pipe(maybeName, Option.getOrThrow)
```

**Why:** Throws exceptions, bypasses Effect's error handling, fails at runtime instead of compile time.

**Correct:**
```typescript
// Handle both cases explicitly
yield* Option.match(maybeUser, {
    onNone: () => Effect.fail(new UserNotFoundError({ userId, message: "Not found" })),
    onSome: Effect.succeed,
})

// Or provide a default
const name = Option.getOrElse(maybeName, () => "Anonymous")

// Or use Option.map for transformations
const upperName = Option.map(maybeName, (n) => n.toUpperCase())
```

## Use Effect 4 service contracts

```typescript
// Effect 4: define a service contract and provide its implementation with a Layer.
export class UserService extends Context.Service<UserService, {
    readonly findById: (id: UserId) => Effect.Effect<User, UserNotFoundError>
}>()("myapp/UserService") {}

const UserServiceLayer = Layer.effect(
    UserService,
    Effect.gen(function* () {
        const repo = yield* UserRepo
        return UserService.of({ findById: id => repo.findById(id) })
    })
)
```

V3 `Effect.Service` / `.Default` patterns are confined to `salesforcedx-vscode-services-v3-compat`.

## FORBIDDEN: Ignoring Errors with orDie

```typescript
// FORBIDDEN (in most cases)
yield* someEffect.pipe(Effect.orDie)
```

**Why:** Converts recoverable errors to defects (unrecoverable), loses error information.

**Acceptable exceptions:**
- Truly unrecoverable situations (invalid program state)
- After exhausting all recovery options
- In test setup code

**Correct:**
```typescript
// Handle errors explicitly
yield* someEffect.pipe(
    Effect.catchTag("RecoverableError", (err) =>
        Effect.fail(new DomainError({ message: err.message }))
    ),
)
```

## FORBIDDEN: mapError Instead of catchTag

```typescript
// FORBIDDEN
yield* effect.pipe(
    Effect.mapError((err) => new GenericError({ message: String(err) }))
)
```

**Why:** Loses error type information, can't discriminate between error types.

**Correct:**
```typescript
yield* effect.pipe(
    Effect.catchTag("SpecificError", (err) =>
        Effect.fail(new MappedError({ message: err.message }))
    ),
)
```

## FORBIDDEN: Mixing Effect and Promise Chains

```typescript
// FORBIDDEN
const result = await someEffect.pipe(
    Effect.runPromise,
).then(data => {
    // Mixing Promise chain with Effect
    return Effect.runPromise(anotherEffect(data))
})
```

**Why:** Loses Effect composition benefits, error handling becomes inconsistent.

**Correct:**
```typescript
const program = Effect.gen(function* () {
    const data = yield* someEffect
    return yield* anotherEffect(data)
})

const result = await Effect.runPromise(program)
```

## FORBIDDEN: Mutable State Without Ref

```typescript
// FORBIDDEN
let counter = 0
const increment = Effect.sync(() => { counter++ })
```

**Why:** Race conditions, not testable, not composable, breaks referential transparency.

**Correct:**
```typescript
const program = Effect.gen(function* () {
    const counter = yield* Ref.make(0)
    yield* Ref.update(counter, (n) => n + 1)
    return yield* Ref.get(counter)
})
```

## FORBIDDEN: Using Date.now() or new Date() Directly

```typescript
// FORBIDDEN
const now = new Date()
const timestamp = Date.now()
```

**Why:** Not testable, introduces non-determinism, hard to mock in tests.

**Correct:**
```typescript
import { Clock } from "effect"

const now = yield* Clock.currentTimeMillis
const date = yield* Clock.currentTimeZone.pipe(
    Effect.map((tz) => new Date())
)
```
