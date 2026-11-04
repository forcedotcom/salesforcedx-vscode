# Running Code Builder E2E in CI

`codeBuilderE2E.yml` — the 15-package container matrix — isn't wired to run per-PR. Trigger it manually via `workflow_dispatch` when you need a real CI read (not just local `npm run test:container:local`).

## The hard requirement: a compatible `runId`

The orchestrator downloads the VSIX via:

```
gh run download <runId> -n "VS Code Extensions" -R forcedotcom/salesforcedx-vscode
```

`runId` must be an Actions run whose own `build-all` job (from `buildAll.yml`) uploaded an artifact literally named `VS Code Extensions`. **Not every workflow run qualifies** — only ones that ran `buildAll.yml` (directly or via `buildAndTest.yml`). Picking an arbitrary run ID fails immediately with a 404/download error.

## Dispatch

```bash
gh workflow run codeBuilderE2E.yml \
  --ref <branch> \
  -f runId=<build-all-run-id> \
  -f image_tag=latest
```

- `--ref` picks which version of the workflow *file* runs (use your branch if its fixes/specs live there).
- Always runs the full 15-package matrix — no package-scoping dispatch input.
- `gh workflow run` occasionally 500s transiently. Retry 2-3× with a short gap before concluding it's broken.

## Finding a `runId`

**Your own branch's latest push** — every push to a non-main/non-develop branch auto-triggers "Commit Workflow" (`testCommitExceptMain.yml` → `buildAndTest.yml` → `buildAll.yml`):

```bash
gh run list --branch <branch> --workflow "Commit Workflow" --limit 1 \
  --json databaseId,status,conclusion,headSha
```

Use that run's `databaseId`. **Verify `headSha` matches your current `HEAD`** — an old run tests stale bytes, not your latest commit.

**A specific commit/tag/release candidate with no CI history** (e.g. testing a tagged release build, or a branch already deleted post-release) — dispatch `nightly.yml` in dry-run against that exact commit SHA, using a branch whose `nightly.yml` has a `build-all` job:

```bash
gh workflow run nightly.yml --ref <branch-with-build-all-job> \
  -f branch=<commit-sha-or-ref> \
  -f dry-run=true
```

`dry-run=true` is load-bearing — omitting it risks a real marketplace publish. This rebuilds the exact source faithfully (not a repackage of already-published VSIX assets); the result is equivalent for testing purposes.

**Before dispatching `codeBuilderE2E`, confirm the build-all job actually finished:**

```bash
gh run view <runId> --json jobs -q '.jobs[] | select(.name | test("build-all"; "i")) | {name,status,conclusion}'
```

Dispatching before it completes 404s on the artifact download (it doesn't exist yet).

## Checking results

```bash
gh run view <runId> --json status,conclusion
gh run view <runId> --json jobs -q '.jobs[] | {name,conclusion}'
```

Per-job logs, including while the overall run is still in progress (as long as that specific job finished):

```bash
gh api repos/forcedotcom/salesforcedx-vscode/actions/jobs/<jobId>/logs
```

(`gh run view --job <id> --log` refuses while the parent run is still in progress, even for already-completed jobs — use the `gh api .../logs` form instead in that case.)

## Known gotchas

- **`ERR_PNPM_OUTDATED_LOCKFILE` after a `develop` merge**: a dependency specifier changed (e.g. `*` → `workspace:*`) but `pnpm-lock.yaml` wasn't regenerated for it. Fix: `pnpm install --lockfile-only`, verify the diff is just that one specifier, commit.
- **Artifact-wipe on retries**: a failed spec's screenshot/trace can get overwritten by a *later* retry/phase in the *same* orchestrator run before upload. If you need visual evidence of a specific failure, prefer a `console.log`-based diagnostic (survives reliably in the Actions log) over relying on the screenshot/trace artifact.
- **`rg -r`**: `-r`/`--replace` sets replacement text, not recursive search. `rg -rln "pattern"` silently corrupts your *displayed* grep output (never the file) by substituting matched text — a real, repeated mistake. Use `rg -n`, never combine `-r` into a short-flag cluster unless you mean to replace.
