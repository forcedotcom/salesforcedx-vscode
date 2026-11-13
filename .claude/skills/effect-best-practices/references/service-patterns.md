# Effect 4 service patterns

Use these patterns for first-party Effect 4 code. `Effect.Service`, its generated accessors, and `.Default` belong only in the isolated V3 compatibility implementation.

## Define a service

Use `Context.Service` for a service interface. Implement it with `Layer.effect` and return `Service.of(...)`.

```ts
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

type UserServiceShape = {
  readonly findById: (id: UserId) => Effect.Effect<User, UserNotFoundError>;
};

export class UserService extends Context.Service<UserService, UserServiceShape>()('myapp/UserService') {}

export const UserServiceLayer = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const repo = yield* UserRepo;
    return UserService.of({
      findById: Effect.fn('UserService.findById')(function* (id: UserId) {
        return yield* repo.findById(id);
      })
    });
  })
);
```

## Compose dependencies

Layer requirements are explicit in TypeScript. Provide them where the graph is assembled; don't hide dependencies in a V3 `dependencies` list.

```ts
export const AppLayer = UserServiceLayer.pipe(
  Layer.provide(UserRepoLayer),
  Layer.provideMerge(SharedInfrastructureLayer)
);
```

At call sites, yield the service or use its `use` helper:

```ts
const program = Effect.gen(function* () {
  const users = yield* UserService;
  return yield* users.findById(userId);
});

const oneCall = UserService.use(service => service.findById(userId));
```

## Caller-provided implementations

Keep the tag as an interface when the host or test owns the implementation. Supply each implementation with `Layer.succeed(Service, Service.of(value))`; don't invent a default backend.

```ts
export const FakeUserServiceLayer = Layer.succeed(
  UserService,
  UserService.of({ findById: () => Effect.succeed(testUser) })
);
```

Use `Context.Reference` for a value-like service with a genuine default. Keep `Context.Tag` only for existing third-party APIs that require it.
