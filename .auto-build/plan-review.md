Plan reviewed vs `PLAN-REVIEW.md` + WI `W-23675163`.

**Fix applied (was high):** verification claimed helper package tests cover `createDreamhouseOrg` — they don't. Grep on `packages/playwright-vscode-ext/test` is empty. Now: compile/lint/helper suite prove the delete doesn't break the package; no new tests.

**Also:** dropped `and/or` on web vs desktop; both scripts exist.

**Approve.** Scope = delete unused `utils/dreamhouseScratchOrgSetup.ts`. One commit. No port. No escape hatch.

No commit/push.
