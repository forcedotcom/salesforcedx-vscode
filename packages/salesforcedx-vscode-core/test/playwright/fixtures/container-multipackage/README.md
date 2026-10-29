# container-multipackage fixture

A minimal SFDX project with TWO `packageDirectories` bind-mounted into the Code Builder container as
a THIRD workspace shape, alongside the standard `container-workspace` (single package dir) DX project
and the non-project `container-noproject` folder.

The orchestrator (`scripts/codeBuilderLocalE2E.ts`) opens `container-workspace` first and runs the
normal container suites against it. It then re-seeds `coder.json` to point code-server at THIS folder
and `restart()`s, so the multi-package suites (`test:container:multipackage`, e.g. apex-log
`apexGenerateClassMultiPackageDirs`) run against a workspace where the output-directory picker must
list BOTH package dirs' `classes` folders.

Load-bearing shape (mirrors the desktop `multiPackageNoOrgTest` fixture): the output-dir picker BFS-
searches each `packageDirectory` for folders named `classes`, so both must exist on disk:

- `force-app` (default package) with `main/default/classes` — appears as `force-app/main/default/classes`.
- `extra-pkg` (second package) with `classes` directly under it — appears as `extra-pkg/classes`.

The `classes` folders are kept empty via `.gitkeep`; the picker enumerates directories, not their
contents. Keep this fixture minimal — its only job is to present two package-directory `classes`
folders to the picker. Do NOT add a second package dir to the SHARED `container-workspace` fixture:
that would make every class/trigger-create command in the other apex specs start prompting a dir
picker (a regression). Use this separate mount instead.
