# Effect 4 layer patterns

## Compose a graph

Effect 4 services declare requirements in their `Layer` types. Keep each service layer focused, then provide dependencies at the composition boundary.

```ts
const OrderServiceLayer = Layer.effect(
  OrderService,
  Effect.gen(function* () {
    const users = yield* UserService;
    const products = yield* ProductService;
    return OrderService.of({
      create: Effect.fn('OrderService.create')(function* (input: CreateOrderInput) {
        const user = yield* users.findById(input.userId);
        const product = yield* products.findById(input.productId);
        return yield* createOrder(user, product, input);
      })
    });
  })
);

const AppLayer = OrderServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(UserServiceLayer, ProductServiceLayer)),
  Layer.provideMerge(DatabaseLayer)
);
```

Use `Layer.provide` when the dependency is private to the resulting layer. Use `Layer.provideMerge` when callers also need the dependency service.

## Infrastructure

Provide host infrastructure once at the app boundary. Don't pass shared services, refs, or publishers as per-call parameters.

```ts
const AppLayer = Layer.mergeAll(UserServiceLayer, OrderServiceLayer).pipe(
  Layer.provide(Layer.mergeAll(FileSystemLayer, DatabaseLayer))
);
```

## Configuration-dependent layers

Read validated config in the layer effect, then construct the service value:

```ts
const ApiClientLayer = Layer.effect(
  ApiClient,
  Effect.gen(function* () {
    const apiKey = yield* Config.Redacted('API_KEY');
    const baseUrl = yield* Config.URL('API_BASE_URL');
    return ApiClient.of(makeApiClient({ apiKey, baseUrl }));
  })
);
```

`ConfigProvider.layer(provider)` supplies a provider to an Effect or Layer. Use `Config.String`, `Config.Int`, `Config.Boolean`, and other V4 constructors.

## Scoped resources

Use `Layer.effect` with `Effect.acquireRelease` or `Effect.addFinalizer` for resources owned by a layer. Closing its `ManagedRuntime` runs finalizers.

```ts
const StatusServiceLayer = Layer.effect(
  StatusService,
  Effect.gen(function* () {
    const item = vscode.window.createStatusBarItem();
    yield* Effect.addFinalizer(() => Effect.sync(() => item.dispose()));
    return StatusService.of({ show: Effect.sync(() => item.show()) });
  })
);
```

## Tests

Replace a service with a focused layer; keep the real consumer code:

```ts
const TestLayer = Layer.succeed(
  UserService,
  UserService.of({ findById: () => Effect.succeed(testUser) })
);

const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
```
