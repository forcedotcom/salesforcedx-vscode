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
