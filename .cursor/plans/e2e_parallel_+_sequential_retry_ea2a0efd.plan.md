---
name: E2E Parallel + Sequential Retry
overview: Enable parallel E2E tests in CI with automatic sequential retry of failures using Playwright's --last-failed flag.
todos:
  - id: config-change
    content: Modify createDesktopConfig.ts to allow parallel workers in CI (controlled by E2E_SEQUENTIAL env var)
    status: completed
  - id: workflow-update
    content: 'Update coreE2E.yml with two-step approach: parallel first, sequential --last-failed on failure'
    status: completed
isProject: false
---

# E2E Parallel + Sequential Retry

## Current State

Your config in `[createDesktopConfig.ts](packages/playwright-vscode-ext/src/config/createDesktopConfig.ts)` explicitly disables parallelism in CI:

```typescript
fullyParallel: !process.env.CI,
workers: 1  // in CI
```

## Playwright's Built-in Support

Playwright 1.44+ has `--last-failed` which reruns only tests that failed in the previous run, using `.last-run.json` in `test-results/`.

**Limitation**: `--last-failed` requires the `test-results/.last-run.json` file from the previous run. In GHA, each step starts fresh, so you need to preserve this file between steps.

## Proposed Approach

### Option A: Two-Step Workflow (Recommended)

1. **Step 1**: Run tests in parallel (remove `workers: 1`)
2. **Step 2**: If step 1 fails, rerun with `--last-failed` (sequential)

Changes needed:

**1. Config change** - remove CI worker restriction:

```typescript
// createDesktopConfig.ts
...(process.env.CI ? { workers: 1 } : {}),  // DELETE this line
// OR make configurable:
...(process.env.E2E_SEQUENTIAL ? { workers: 1 } : {}),
```

**2. Workflow change** - add retry step:

```yaml
- name: Run E2E tests (parallel)
  id: parallel-run
  continue-on-error: true
  run: npm run test:desktop -w salesforcedx-vscode-core -- --reporter=html

- name: Retry failed tests (sequential)
  if: steps.parallel-run.outcome == 'failure'
  env:
    E2E_SEQUENTIAL: 1
  run: npm run test:desktop -w salesforcedx-vscode-core -- --last-failed --reporter=html
```

### Option B: Built-in Retries Only

Playwright already has `retries: 2` configured for CI. But these retries run the same test again immediately - still subject to the same race condition.

## Is It Worth It?

**Pros:**

- Faster happy path (parallel first)
- Sequential retry gives flaky tests a stable second chance
- Playwright natively supports this pattern

**Cons:**

- Adds workflow complexity
- Sequential retry adds time on failure (~doubles wall clock on flaky runs)
- With `maxFailures: 3`, you already bail early

**My assessment**: Marginal value given you already have:

- `retries: 2` in the config
- `maxFailures: 3` to limit damage

The main benefit would be if you suspect tests are flaky due to parallelism specifically (resource contention, shared state). If failures are mostly network/external service issues, parallel retry wouldn't help differently than sequential.

## Recommended Next Step

Before implementing, check recent E2E failure patterns. If failures cluster when running multiple tests simultaneously, this approach helps. If failures are random/network-related, keep current setup.
