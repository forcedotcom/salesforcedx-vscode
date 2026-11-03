# Effect 4 error patterns

## Define typed errors

Use `Schema.TaggedError` with the message and fields callers actually inspect.

```ts
import * as Schema from 'effect/Schema';

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()('UserNotFoundError', {
  userId: UserId,
  message: Schema.String
}) {}
```

For HttpApi schemas, add the V4 status annotation after defining the error schema:

```ts
import * as HttpApiSchema from 'effect/http-api/HttpApiSchema';

export const UserNotFoundResponse = UserNotFoundError.pipe(HttpApiSchema.status(404));
```

## Handle typed failures narrowly

Prefer `catchTag` / `catchTags`; preserve failures that need no recovery.

```ts
const user = yield* repo.findById(id).pipe(
  Effect.catchTag('DatabaseError', error =>
    Effect.fail(new UserNotFoundError({ userId: id, message: error.message }))
  )
);
```

Catch only where the caller can recover or improve the message. Don't replace unrelated errors with a generic tag or catch defects as typed failures.

## Accumulate failures

- `Effect.partition(items, f)` — run every item and return successes and failures.
- `Effect.validate(items, f)` — run every item; fail with all typed failures, otherwise return all successes.
- `Effect.validateFirst(items, f)` — stop at the first success.

Typed-error accumulation does not capture interruption; cancellation still aborts the whole operation.

```ts
const [successes, failures] = yield* Effect.partition(items, processItem, { concurrency: 4 });
```

Use `Effect.exit` per item only when interruption or defects must also be captured as data.

## Retry

Retry only the expected transient error. Keep typed failures, defects, and interruption distinct.

```ts
const request = Effect.fn('GitHub.request')(function* (route: string) {
  return yield* sendRequest(route).pipe(
    Effect.catchTag('RateLimitError', error =>
      Effect.sleep(Duration.millis(error.retryAfterMillis)).pipe(Effect.andThen(sendRequest(route)))
    )
  );
});
```
