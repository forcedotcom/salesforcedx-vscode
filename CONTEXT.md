# Context Glossary

## Swallowed rejection

Rejected Promise / thrown error in a Playwright spec or helper converted to a
falsy/sentinel value or discarded, instead of failing the test. Shapes:

- `.catch(() => {})`
- `.catch(() => false | undefined | null)`
- `.catch(() => <any sentinel>)`
- `try { await ... } catch {}` / `try { ... } catch (_) {}`

Banned in `packages/playwright-vscode-ext/src/**` and `packages/*/test/playwright/**`
via `local/no-swallowed-rejection`.

Why: hides flake-causing races; makes best-effort probing the default. Skill rule
"fail early, avoid fallbacks/retries"
(`.claude/skills/playwright-e2e/references/coding-playwright-tests.md`).

Escape: per-line `// eslint-disable-next-line local/no-swallowed-rejection` + inline
reason (e.g. cleanup in `afterEach`, optional DOM attribute read).
