# SOQL Builder UI

`@salesforce/soql-builder-ui` is the browser-safe Lit application for the SOQL Builder. It owns rendering and user interaction but does not import the VS Code API, extension services, or the extension-host message protocol.

Consumers provide a `SoqlBuilderHost` implementation before connecting the `<soql-builder-app>` element:

```ts
import { SoqlBuilderApp } from '@salesforce/soql-builder-ui';

const app = new SoqlBuilderApp();
app.host = myHost;
document.querySelector('#main')?.append(app);
```

The Salesforce SOQL extension supplies an adapter backed by its existing Effect services and VS Code message bridge. A normal browser can provide an HTTP, mock, or in-memory adapter without emulating `acquireVsCodeApi()`.

See `packages/soql-builder-web-example` for a standalone Node/browser consumer that uses Salesforce CLI-managed authorization through `@salesforce/core`.

This package currently contains the From/Fields/query-preview spike rather than the complete SOQL Builder.
