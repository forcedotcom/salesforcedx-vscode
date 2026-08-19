# Standalone SOQL Builder web example

This private example package demonstrates how to run `@salesforce/soql-builder-ui` in a normal browser, independent of the VS Code extension runtime.

The browser uses an `HttpSoqlBuilderHost`. A local Node server uses `@salesforce/core` to resolve an explicit alias or username against the global Salesforce state, open its CLI-managed `AuthInfo` record, and retrieve org metadata with `Connection.describeGlobal()` and `Connection.describe()`. Authentication data and access tokens remain on the server and are never returned by the example API.

## Prerequisites

- Install Salesforce CLI and authorize an org.
- Pass an authorized alias or username when starting the server.

To authorize an org and give it an alias:

```bash
sf org login web --alias builder-demo
```

## Run

From the repository root:

```bash
npm run compile --workspace @salesforce/soql-builder-web-example
npm start --workspace @salesforce/soql-builder-web-example -- --target-org builder-demo
```

Then open `http://127.0.0.1:4173`.

`--target-org` accepts either an alias or username. It is intentionally required so server behavior does not depend on the directory from which it was launched. Use `--port <number>` to choose a different loopback port.

## Runtime boundary

```text
Browser
  @salesforce/soql-builder-ui
              ↕ SoqlBuilderHost
  HttpSoqlBuilderHost
              ↕ same-origin JSON
Node server bound to 127.0.0.1
  @salesforce/core Connection
              ↕ authenticated Salesforce APIs
Salesforce org
```

The example exposes only the endpoints needed by the current From/Fields spike:

- `GET /api/sobjects` returns queryable object names and labels.
- `GET /api/sobjects/:apiName` returns the selected object's field metadata.

The object API name is validated before it reaches `@salesforce/core`. Static files are served from a fixed allowlist, the server binds only to loopback, and the page uses a restrictive Content Security Policy. This is a development example, not a production deployment or multi-user authentication design.
