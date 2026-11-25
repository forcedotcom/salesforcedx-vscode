# container-noproject fixture

A deliberately non-SFDX folder (no `sfdx-project.json` anywhere in it) bind-mounted into the Code
Builder container as a SECOND workspace shape, alongside the standard `container-workspace` DX
project.

The orchestrator (`scripts/codeBuilderLocalE2E.ts`) opens `container-workspace` first and runs the
normal container suites against it. It then re-seeds `coder.json` to point code-server at THIS
folder and `restart()`s, so the "no project open" visibility suites (`test:container:noproject`,
e.g. metadata `noProjectCommandsHidden`) run against a workspace where the SFDX project-gated
commands must NOT be contributed.

Keep it trivial: its only job is to be a folder code-server can open that is not a DX project. Do
NOT add `sfdx-project.json` or any `force-app` metadata here — that would defeat its purpose.

## `scratch/`

An empty, checked-in-only-as-a-placeholder (`.gitkeep`) subfolder. The `createProject`/
`createProjectWithManifest` container specs (metadata) target THIS subfolder as the parent dir for
"SFDX: Create Project [with Manifest]" — scaffolding a project here, not at this fixture's root,
keeps the mount's own root free of `sfdx-project.json` for every other no-project spec. Each spec
removes its own scaffolded project in `afterEach` (`removePathsInContainer`, since the files are
owned by the container's `codebuilder` user); `scratch/` itself is never deleted so the mount
doesn't need to be re-created between runs.
