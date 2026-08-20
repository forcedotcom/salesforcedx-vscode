# SOQL Builder UI

`@salesforce/soql-builder-ui` is the private, browser-safe Lit and Effect foundation for the SOQL Builder. It owns presentation, validated browser DTOs, UI state and actions, and scoped controller lifecycle primitives. It does not import VS Code APIs, extension services, JSforce, or extension-host message types.

The extension owns the VS Code message driver and connects it to one managed Effect runtime for the lifetime of the Lit application. An explicit migration build can package that application for demonstrations and integration testing. Normal release builds continue to build and activate the existing LWC application until the cutover story.

This workspace is not published to npm and does not include an example Node server.
