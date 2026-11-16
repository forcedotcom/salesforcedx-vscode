---
name: snyk-debug
description: Diagnose Snyk CLI auth and CI dependency-scan failures, run `snyk test --all-projects`, and fix applicable vulnerable dependency paths.
review: never
---

# Snyk Debug

Diagnose Snyk Open Source failures in the intended checkout and make narrow dependency fixes.

## 1. Confirm checkout and CLI

1. Resolve `git rev-parse --show-toplevel`, branch, HEAD, and `git status --short --branch`.
2. Confirm the root is the user's intended checkout or PR worktree. Stop if it is not; never scan a similarly named checkout by guess.
3. Run `command -v snyk` and `snyk --version`. Install only if the user asked and the repository's tooling specifies how.

## 2. Check authentication before the full scan

Auth may use `SNYK_TOKEN` or a local OAuth profile. Never print tokens, config values, or auth files.

1. Check whether `SNYK_TOKEN` is set; do not echo its value. An unset variable does not prove the CLI is unauthenticated.
2. Run `snyk test` against one explicit, supported manifest in the intended checkout as an auth preflight. A completed scan (exit 0 or 1) confirms API access; exit 1 means findings, not auth failure.
3. If Snyk reports missing/invalid auth, stop before `--all-projects`. Ask the user to run `snyk auth` and complete the browser flow, then retry. `snyk auth` opens a browser and stores credentials; do not pass tokens as command arguments.

Snyk's [auth docs](https://docs.snyk.io/developer-tools/snyk-cli/commands/auth) describe the local browser flow. Its [test docs](https://docs.snyk.io/developer-tools/snyk-cli/commands/test) define exit codes: 0 no vulnerabilities, 1 vulnerabilities found, 2 scan failure, 3 no supported projects.

## 3. Reproduce the scan

From the confirmed repository root, write the report to a unique path in the system temp directory and run:

```sh
report_dir="$(mktemp -d)"
snyk test --all-projects --json-file-output="$report_dir/all-projects.json"
```

Keep the human-readable output and JSON report. Do not use `--fail-fast`; collect errors and findings across projects. Exit 1 means findings, not necessarily that every detected project scanned: inspect the full output for project-level errors. Exit 2 means scan failure; identify project-detection, dependency-resolution, network, and auth errors, then rerun. If a CLI failure remains unclear, rerun the narrowed command with `-d`. Exit 3 means no supported projects were found.

`--all-projects` can discover generated, cached, template, and fixture manifests in addition to CI projects. Identify the exact CI scan scope from workflow configuration and the Snyk check/report before attributing local findings to CI. If Snyk's report is inaccessible, state that limitation and label local results as a reproduction, not the CI findings.

## 4. Trace each applicable finding

For every security finding in the CI scope:

1. Record manifest/lockfile, vulnerable package and version, Snyk issue ID/severity, every reported dependency path, and the smallest patched version Snyk supports.
2. Trace each path to its direct dependency in the owning `package.json`. Use the repository's package manager (`pnpm why` for pnpm; `npm explain` for npm) and inspect the relevant manifest and lockfile.
3. Separate source workspaces from generated output, packaged VS Code dependencies, sample templates, and independent consumer fixtures. Fix only paths that are in scope and owned here.
4. Prefer the lowest compatible direct-consumer update that resolves the finding. Update its manifest and lockfile with the repository's package manager. For a transitive-only fix, use the package manager's targeted resolution mechanism only if repo policy allows it.
5. Check release notes for major upgrades and run the affected package's build/tests. Do not bulk-run `snyk fix`, hand-edit lockfiles, add overrides, add ignores, or exclude findings merely to turn the check green.

For pnpm, use `pnpm why <package>` and a package-scoped update. For npm fixture projects, work in that fixture and update its `package-lock.json` with npm. Do not reuse `node_modules` across checkouts.

## 5. Verify and report

1. Rerun the affected project scans, then `snyk test --all-projects` from the same checkout. Compare issue IDs and vulnerable paths, not just the exit code.
2. Run the affected workspace checks and inspect the final diff for unintended manifest or lockfile changes.
3. Report checkout/commit, exact commands and exit codes, which findings cleared/remain, any scan errors, and whether the Snyk CI report was directly verified.
4. Do not commit, push, change PR metadata, or claim CI is fixed without a new CI result.

## Completion criterion

Every CI finding is either reproduced and fixed with a passing targeted rescan, confirmed out of scope with evidence, or explicitly blocked by unavailable Snyk report/access or an unresolved scan error. The final report distinguishes these outcomes.
