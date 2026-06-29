# Surface Apex tests through the VS Code Test API, not a custom TreeView

- drivers: web rewrite; bundled Test API — filtering (org-only vs project via TestTags), search box, namespace/package tree ([ADR 0002](./0002-test-discovery-api.md) feeds the items)

Trade-off:

- Test API object model forces a class shell (`ApexTestController` wrapping `vscode.tests.createTestController`)

- delegate-command lens routing unchanged — see [ADR 0001](./0001-codelens-delegate-commands.md)
