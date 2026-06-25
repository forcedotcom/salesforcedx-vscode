# Surface Apex tests through the VS Code Test API, not a custom TreeView

Drivers: web rewrite; bundled Test API wins for free — filtering (org-only vs project via TestTags), search box, namespace/package tree ([ADR 0002](./0002-test-discovery-api.md) feeds the items).

Trade-off: the Test API object model forces a class shell (`ApexTestController` wrapping `vscode.tests.createTestController`).

Delegate-command lens routing is unchanged — see [ADR 0001](./0001-codelens-delegate-commands.md).
