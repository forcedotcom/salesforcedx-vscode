---
description: Flag low-value unit tests (type system, framework wrappers, pass-throughs). Recommend refactors when 3+ mocks = poor code structure.
---

# Unit Test Critic

Flag tests that verify compiler/framework behavior instead of logic. Flag testability issues (heavy mocking = code smell).

## Flag as low-value

### 1. Type-system tests
Asserts return type. Compiler already checks.

```typescript
it('returns Connection', async () => {
  const conn = await getConnection();
  expect(conn).toBeInstanceOf(Connection);
});
// LOW_VALUE: TypeScript enforces type
```

### 2. Framework tests
Tests `Effect.tryPromise` wraps errors, or `Promise.resolve` works. Trust frameworks.

**Test only if custom logic:** error message interpolation, data mapping, conditional error types.

Low-value:
```typescript
it('wraps error in CustomError', async () => {
  mockLib.mockRejectedValue(new Error('boom'));
  const exit = await Effect.runPromiseExit(myMethod());
  expect(Exit.isFailure(exit)).toBe(true);
  // Testing Effect.tryPromise works
});
```

Valuable:
```typescript
it('includes context in error message', async () => {
  mockLib.mockRejectedValue(new Error('boom'));
  const exit = await Effect.runPromiseExit(processFile('/path/to/file'));
  const error = /* extract */;
  expect(error.message).toContain('/path/to/file'); // Custom interpolation
});
```

### 3. Pass-through wrappers
Calls `libMethod()`, returns result. No transformation/composition/side effects.

```typescript
// Implementation
const listAuths = () => Effect.tryPromise(() => AuthInfo.listAllAuthorizations());

// Test
it('returns authorizations', async () => {
  const auths = [{username: 'a@example.com'}];
  jest.spyOn(AuthInfo, 'listAllAuthorizations').mockResolvedValue(auths);
  const result = await Effect.runPromise(listAuths());
  expect(result).toEqual(auths);
  // No logic to test
});
```

### 4. Mock-everything
All deps mocked, asserts mocks called. Tests harness, not code.

### 5. Single happy-path
No edge cases, error branches, state transitions. Brittle, low signal.

### 6. Trivial getters/setters
No computed logic.

## Valuable (don't flag)

- **Calculations:** compute output (math, aggregation, scoring, formatting)
- **Pure function snapshots:** input → output, snapshot entire result vs field-by-field assertions. Easier change review.
- **Regex matching:** validate matches expected + rejects invalid
- **Data transformation:** map/filter/reduce, parsing, formatting
- **Composition:** operations piped with logic between
- **State mutations:** cache updates, concurrent access, atomic ops
- **Error handling w/ custom logic:** conditional error types, interpolated context from multiple sources, recovery strategies
- **Complex validations**
- **Integration boundaries:** real I/O, real async
- **Security logic**
- **Numeric edge cases:** overflow, precision, zero/negative

## Testability: 3+ mocks = code smell

Heavy mocking = poor boundaries. Logic mixed with I/O, tight coupling, hard-wired deps.

### Refactor patterns

#### 1. Separate I/O from logic
Read + process → split into reader + processor. Test processor with data, no FS mocks.

Before:
```typescript
const processConfig = (path: string) => {
  const raw = fs.readFileSync(path, 'utf8');
  const config = JSON.parse(raw);
  return transform(config);
};
// Test requires fs mock
jest.mock('fs');
```

After:
```typescript
const readConfig = (path: string): Effect<Config> => /* ... */;
const processConfig = (config: Config) => transform(config);

it('processes config', () => {
  const result = processConfig({foo: 'bar'});
  expect(result).toMatchSnapshot();
});
```

#### 2. Curried functions
Partial application = test many scenarios without repeating setup.

Before:
```typescript
const validate = (schema: Schema, data: Data) => /* ... */;

it('validates case 1', () => {
  expect(validate(schema, data1)).toBe(true);
});
it('validates case 2', () => {
  expect(validate(schema, data2)).toBe(true);
});
// Schema repeated
```

After:
```typescript
const validate = (schema: Schema) => (data: Data) => /* ... */;
const validateUser = validate(userSchema);

it('validates case 1', () => expect(validateUser(data1)).toBe(true));
it('validates case 2', () => expect(validateUser(data2)).toBe(true));
// Schema setup once
```

#### 3. Pure functions over methods
Extract logic from classes → standalone pure functions.

Before:
```typescript
class Processor {
  constructor(private dep: Dep) {}
  process(data: Data) {
    return this.dep.transform(data);
  }
}
// Test requires class + mock dep
```

After:
```typescript
const process = (dep: Dep, data: Data) => dep.transform(data);
// Test calls directly
```

#### 4. Effect services
Hard-wired deps → Effect.Service + Layer. Testable via Layer substitution, no mocks.

Before:
```typescript
const fetchData = async () => {
  const response = await axios.get(url);
  return response.data;
};
// Test requires axios mock
jest.mock('axios');
```

After:
```typescript
class HttpService extends Effect.Service<HttpService>()('HttpService', {
  effect: Effect.sync(() => ({
    get: (url: string) => Effect.tryPromise(() => axios.get(url))
  }))
}) {}

const fetchData = HttpService.get(url);

// Mock via Layer
const MockHttp = Layer.succeed(HttpService, {
  get: () => Effect.succeed({data: 'mock'})
});
Effect.runPromise(fetchData.pipe(Effect.provide(MockHttp)));
```

#### 5. Accept data, don't fetch
Signature takes data, not path/URL. Caller handles I/O, function handles logic.

Before:
```typescript
const analyze = async (url: string) => {
  const data = await fetch(url);
  return compute(data);
};
// Test requires fetch mock
```

After:
```typescript
const analyze = (data: Data) => compute(data);
// Test passes data directly
```

## Output format

```
path/to/test.ts:42: ⚠️ LOW_VALUE: pass-through wrapper, no logic
  Code: ConnectionService.listAllAuthorizations() wraps AuthInfo.listAllAuthorizations() in Effect.tryPromise.
  Why: compiler checks types; Effect handles error wrapping. No transformation/composition/custom logic.
  Recommendation: delete, or add integration test if consumer behavior matters.

path/to/test.ts:84: 🔧 TESTABILITY: 4 mocks = structure issue
  Current: reads FS, fetches HTTP, queries DB, transforms. Mocks: fs, axios, db.
  Problem: does too much. I/O mixed with logic, hard-wired deps.
  Refactor:
    - Split: readFile(path) → fetchData(url) → queryDB(id) → transform(data)
    - Use Effect services for I/O (FileService, HttpService, DBService)
    - Test transform(data) with data, no I/O mocks
  Benefit: isolated logic, faster, clearer boundaries. Curried transform = (schema) => (data) => ... = test many data vs 1 schema.
```

## When to run

- New test files
- PR review (test changes)
- Test suite brittle/hard to maintain
- Before adding mocks

## Severity

- **LOW_VALUE:** minimal signal, delete or replace
- **TESTABILITY:** structure makes testing hard, refactor suggested
- **GOOD:** valuable (context, not complaint)
