# SOQL Builder Lit spike

This side-by-side spike proves the framework boundary for a migration from LWC to Lit while using `@vscode-elements/elements` for the UI controls.

The implemented vertical slice uses the production `ToolingSDK`, `ToolingModelService`, VS Code message protocol, and saved webview state. It covers object selection, field selection, metadata loading, external query updates, and live query preview. The spike intentionally omits the remaining builder sections; the unchanged LWC builder remains the default UI.

To enable the spike locally:

1. Set `salesforcedx-vscode-soql.experimental.useLitSpike` to `true` in VS Code settings.
2. Run the package's normal local bundle workflow.
3. Open a new SOQL Builder editor. Existing open editors must be reopened after changing the setting.

The generated `dist/lit-spike.html` can also be served in a normal browser. Outside VS Code, the bundle installs an in-memory API with representative objects and fields so the slice can be exercised without an org.

This is not intended for release. Before expanding the migration, validate large-org option counts, keyboard and screen-reader behavior, high-contrast themes, and production bundle size.

The existing SOQL Builder service graph is bundled with Babel type erasure and is excluded from the package TypeScript compile. The spike preserves that boundary. A full migration should add a dedicated type-checkable webview project after the legacy service typing issues are addressed.
