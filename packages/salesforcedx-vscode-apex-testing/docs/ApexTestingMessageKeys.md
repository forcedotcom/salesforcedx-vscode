# Apex Testing extension: message keys (manifest vs runtime)

## Two channels

- **Manifest UI** — `package.json` uses `%key%` placeholders. VS Code resolves them from `package.nls.json` and `package.nls.ja.json`. The ESLint rule `package-json-i18n-descriptions` requires every covered `%key%` to exist in `package.nls.json`.
- **Runtime UI** — Code calls `nls.localize('key', ...)` using the `messages` object from `src/messages/i18n.ts` (with `i18n.ja.ts` overrides). Keys must exist there. The rule `local/no-unused-i18n-messages` tracks usage; it also seeds counts from `package.nls.json`, so keys present in both places are not reported unused solely because they appear in the manifest NLS file.

Keys do **not** need to exist in both files unless you reference the same key from `package.json` **and** from `nls.localize`. When a key is duplicated, keep English strings aligned or consolidate to one path.

## Japanese manifest parity

`package.nls.json` and `package.nls.ja.json` should expose the same key set so JA users do not see raw `%key%` strings. Compare with:

`python3 -c "import json; from pathlib import Path; r=Path('package.nls.json').parent; en=set(json.loads((r/'package.nls.json').read_text())); ja=set(json.loads((r/'package.nls.ja.json').read_text())); print(sorted(en-ja), sorted(ja-en))"`

(Run from `packages/salesforcedx-vscode-apex-testing`.)

## Audit (post–PR 7112 verification)

- **Lint** — `npm run lint` at repo root passed (includes `package-json-i18n-descriptions` and `local/no-unused-i18n-messages` for this package).
- **Merge base** — Compared to `develop` (`git merge-base HEAD develop`): no keys were **removed** from `package.nls.json` / `package.nls.ja.json` or from `i18n.ts` message keys in this branch relative to that base; changes were **additions** (VFS, retrieve, discovery, etc.). If auditing a specific PR, diff against that PR’s merge parent instead of `develop` when they differ.
- **Removed-key grep** — With no net removals vs `develop`, there were no orphaned `%key%` or `nls.localize('key')` targets from this cleanup. Re-run per-key checks if the diff base changes.
