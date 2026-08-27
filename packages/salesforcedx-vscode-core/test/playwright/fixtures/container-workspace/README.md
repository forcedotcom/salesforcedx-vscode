# container-workspace fixture

A minimal, version-controlled SFDX project mounted into the Code Builder container so container
Playwright specs open a workspace with real metadata instead of the image's bare generated project.

The mount + open is wired by `scripts/codeBuilderSeedWorkspace.ts` (invoked by the CI workflow and
the local loop): the host dir is bind-mounted to `/home/codebuilder/fixture-project`, and
`coder.json` is written via `docker exec` to point code-server at it. This deliberately bypasses the
image's `SFDX_COBU_PROJECTNAME` generate path — that runs only on first boot behind the
`~/.codebuilder` gate and lives in image code the CB team owns. See ADR 0022.

Keep it small: one Apex class plus its test is enough for specs that open a file, run a test, or
deploy. Add metadata here as specs need it — a change lands with the test that relies on it.
