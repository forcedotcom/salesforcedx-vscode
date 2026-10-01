---
name: web-console-local-traces
description: Unblock hosted Web Console OTLP to localhost:4318. Chrome Local Network Access (loopback address space) plus grafana/otel-lgtm CORS for https://cdn.web-ide.platform.salesforce.com. Use when Web Console traces fail with CORS, loopback, LNA, or otel-lgtm.
review: never
---

# Web Console local OTLP

Hosted Web Console origin `https://cdn.web-ide.platform.salesforce.com` POSTs to `http://localhost:4318/v1/traces` when `salesforcedx-vscode-salesforcedx.enableLocalTraces` is on (`OTLPTraceExporter` default in `spansWeb.ts`). Two independent blocks; LNA first.

Canonical docker overlay: [observability README](../../../packages/salesforcedx-vscode-services/src/observability/README.md#web-console).

## 1. Chrome Local Network Access

Error: `Permission was denied for this request to access the loopback address space`.

Chrome 142+ [Local Network Access](https://developer.chrome.com/blog/local-network-access) gates public origin → loopback before CORS headers apply.

Web Console often has no extension toolbar and may iframe the CDN origin, so site-settings / CORS extensions fail. Disable the check in a **normal Chrome tab, same profile**:

1. `chrome://flags/#local-network-access-check` → **Disabled**
2. Relaunch Chrome
3. Reload Web Console

**Done when:** console no longer mentions `loopback` / `address space`. Remaining errors are collector CORS.

## 2. otel-lgtm HTTPS CORS

Image `grafana/otel-lgtm` allowlists `http://*` only ([v0.33.0 config](https://raw.githubusercontent.com/grafana/docker-otel-lgtm/v0.33.0/docker/otelcol-config.yaml)). HTTPS Salesforce origin does not match.

Overlay file (any path; example `~/.otel-lgtm/otelcol-cors.yaml`):

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins:
            - http://*
            - https://cdn.web-ide.platform.salesforce.com
          allowed_headers:
            - "*"
```

Restart collector with the overlay ([image config paths](https://github.com/grafana/docker-otel-lgtm/blob/v0.33.0/README.md)):

```sh
docker run -d --rm --name otel-lgtm \
  -p 3000:3000 -p 4317:4317 -p 4318:4318 \
  -v "$HOME/.otel-lgtm/otelcol-cors.yaml:/otel-lgtm/otelcol-cors.yaml:ro" \
  -e OTELCOL_EXTRA_ARGS='--config=file:/otel-lgtm/otelcol-cors.yaml' \
  docker.io/grafana/otel-lgtm
```

**Done when:**

```sh
curl -si -X OPTIONS http://localhost:4318/v1/traces \
  -H 'Origin: https://cdn.web-ide.platform.salesforce.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

returns `access-control-allow-origin: https://cdn.web-ide.platform.salesforce.com`.

Plain `["*"]` origin is rejected when credentials are on ([collector HTTP CORS](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/confighttp/README.md)).

## 3. Enable the setting

Web Console Settings → `salesforcedx-vscode-salesforcedx.enableLocalTraces` = `true`. Reload. Grafana: http://localhost:3000 (`admin`/`admin`).

File traces (`enableFileTraces` → `~/.sf/vscode-spans/`) are a different sink — see `span-file-export`. Hosted Web Console cannot write that dir; use this OTLP path.
