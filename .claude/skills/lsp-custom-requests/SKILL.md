---
name: lsp-custom-requests
description: Serialize URIs correctly across LSP custom requests. Use when defining custom LSP requests/notifications with URI params, sending a `URI` over `Connection.sendRequest`, or debugging `[object Object]` / `EntryNotFound` / `workspace/stat`/`readFile`/`readDirectory` failures.
---

# LSP Custom Requests — URI Wire Format

## Why it breaks

- `Connection.sendRequest(method, params)` runs `JSON.stringify(params)`.
- `vscode-uri` `Uri.toJSON()` returns `UriComponents` (plain data). See [microsoft/vscode-uri src/uri.ts](https://github.com/microsoft/vscode-uri/blob/main/src/uri.ts).
- Receiver gets a plain object — no prototype, no `toString`/`fsPath`.
- `uri.toString()` → `"[object Object]"` → `fs.stat`/`readFile` fails with `EntryNotFound`.

## Rules

- Never call `.toString()` / `.fsPath` on a URI received over the wire without rehydrating first.
- Type URI params as `UriComponents` (derived); revive on receive.

## Pattern — UriComponents + revive

Params type derived from `URI.toJSON`:

```ts
import type { URI } from 'vscode-uri';
type UriComponents = ReturnType<URI['toJSON']>;
type MyParams = { uri: UriComponents };

const params: MyParams = { uri: URI.parse(fileUri) };
connection.sendRequest('my/request', params);

const handler = (params: MyParams) => {
  const uri = URI.revive(params.uri);
};
```

Notes:

- `vscode-uri`'s package entry does not re-export `UriComponents`; derive via `ReturnType<URI['toJSON']>`.
- `URI.revive` is the exact inverse of `toJSON` — restores `_formatted` / `_fsPath` caches too.

## Don't

- `uri: URI` on a wire type and use `.toString()` / `.fsPath` on receive — this is the failure mode.
- Pass deserialized params straight to `vscode.workspace.fs.*` — those APIs expect a real `URI` instance.

## When `uri: URI` in params looks fine but isn't

Compiles cleanly (URI on both sides). Runtime receiver sees a plain `UriComponents`. Check the handler log — `uri=[object Object]` confirms.
