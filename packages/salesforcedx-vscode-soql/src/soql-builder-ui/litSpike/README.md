# SOQL Builder Lit spike

This side-by-side spike proves the framework and packaging boundary for a migration from LWC to Lit while using `@vscode-elements/elements` for the UI controls.

The browser-safe Lit application is published from the workspace as `@salesforce/soql-builder-ui`. It imports no VS Code APIs, extension services, or transport messages. The webview container consumes that package and provides a `VscodeSoqlBuilderHost` adapter backed by the production `ToolingSDK`, `ToolingModelService`, VS Code message protocol, and saved webview state. It covers object selection, field selection, metadata loading, external query updates, and live query preview. The spike intentionally omits the remaining builder sections; the unchanged LWC builder remains the default UI.

To enable the spike locally:

1. Set `salesforcedx-vscode-soql.experimental.useLitSpike` to `true` in VS Code settings.
2. Run the package's normal local bundle workflow.
3. Open a new SOQL Builder editor. Existing open editors must be reopened after changing the setting.

The generated `dist/lit-spike.html` can also be served in a normal browser. Outside VS Code, the webview container selects an in-memory `StandaloneSoqlBuilderHost` with representative objects and fields, demonstrating that the same npm package can run without VS Code or an org.

This is not intended for release. Before expanding the migration, validate large-org option counts, keyboard and screen-reader behavior, high-contrast themes, and production bundle size.

The new UI package is type-checked independently. The existing SOQL Builder service graph and the thin VS Code adapter are still bundled with Babel type erasure and excluded from the extension package TypeScript compile. A full migration should make that adapter boundary type-checkable after the legacy service typing issues are addressed.
