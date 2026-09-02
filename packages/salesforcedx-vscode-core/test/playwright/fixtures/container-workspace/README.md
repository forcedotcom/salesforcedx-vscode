# container-workspace fixture

A minimal, version-controlled SFDX project mounted into the Code Builder container so container
Playwright specs open a workspace with real metadata instead of the image's bare generated project.

The mount + open is handled by the `seedWorkspace` function (exported from
`@salesforce/playwright-vscode-ext`; invoked by the orchestrator/CI): the host dir is bind-mounted
to `/home/codebuilder/fixture-project`, and `coder.json` is written via `docker exec` to point
code-server at it. This deliberately bypasses the image's `SFDX_COBU_PROJECTNAME` generate path —
that runs only on first boot behind the `~/.codebuilder` gate and lives in image code the CB team
owns. See ADR 0022.

This one fixture is shared by every package's container specs (it is the single mounted workspace,
so the container opens it once and all specs run against it). Keep it small and add metadata only
when a spec needs it — a change lands with the test that relies on it. Current contents:

- `force-app/main/default/classes/PagedResult.cls` (+ test) — a plain Apex class/test used by the
  core, metadata (deploy), apex-testing (discover/run), and apex-oas (ineligible-class) specs.

Specs that need a throwaway artifact (a `.page` for visualforce, an LWC for lwc, a `.soql` for
soql, a setting for services) create it at runtime via the extension's own command rather than
committing it here, so the shared fixture stays minimal and one spec's artifact can't leak into
another's assertions.
