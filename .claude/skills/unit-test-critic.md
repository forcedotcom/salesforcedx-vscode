---
description: Flag low-value unit tests (type system, framework wrappers, pass-throughs). Recommend refactors when 3+ mocks = poor code structure.
---

# Unit Test Critic

Flag tests verifying compiler/framework behavior vs logic. Flag testability issues (heavy mocking = code smell).

## Flag as low-value

### 1. Type-system tests
Asserts return type. Compiler already checks.

### 2. Framework tests
Tests `Effect.tryPromise` wraps errors, or `Promise.resolve` works. Trust frameworks.

**Test only if custom logic:** error message interpolation, data mapping, conditional error types.

### 3. Pass-through wrappers
Calls `libMethod()`, returns result. No transformation/composition/side effects.

### 4. Mock-everything
All deps mocked, asserts mocks called. Tests harness, not code.

### 5. Single happy-path
No edge cases, error branches, state transitions. Brittle, low signal.

### 6. Trivial getters/setters
No computed logic.

## Valuable (don't flag)

- **Calculations:** compute output (math, aggregation, scoring, formatting)
- **Pure function snapshots:** input → output, snapshot entire result vs field-by-field. Easier change review.
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

#### 2. Curried functions
Partial application = test many scenarios without repeating setup.

```typescript
// Before: validate(schema, data) — schema repeated every test
// After: validate = (schema) => (data) => ...; const validateUser = validate(userSchema);
```

#### 3. Pure functions over methods
Extract logic from classes → standalone pure functions.

#### 4. Effect services
Hard-wired deps → Effect.Service + Layer. Testable via Layer substitution, no mocks.

#### 5. Accept data, don't fetch
Signature takes data, not path/URL. Caller handles I/O, function handles logic.

## Output format

```
path/to/test.ts:42: ⚠️ LOW_VALUE: pass-through wrapper, no logic
  Code: wraps lib call in Effect.tryPromise.
  Why: compiler checks types; Effect handles wrapping. No custom logic.
  Recommendation: delete, or add integration test if consumer behavior matters.

path/to/test.ts:84: 🔧 TESTABILITY: 4 mocks = structure issue
  Problem: I/O mixed with logic, hard-wired deps.
  Refactor: split into steps, use Effect services for I/O, test logic with data.
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
