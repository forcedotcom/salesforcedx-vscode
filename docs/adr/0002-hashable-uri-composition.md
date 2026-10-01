# HashableUri wraps URI by composition, never `extends URI`

`HashableUri` is a structural wrapper `{ readonly uri: URI }` with explicit Effect `Hash`/`Equal` on a `comparisonKey` of URI fields (`scheme`, `authority`, `path`, `query`, `fragment` — not `uri.toString()`), plus Windows drive-letter normalization, not a `URI` subclass. Subclassing broke VS Code RPC serialization (`2414b3a21` strips the subclass for RPC) and `instanceof`/dedupe failed across separately-bundled `vscode-uri` copies; the wrapper was rewritten as composition in `23b37c5d9` (W-21973088).

## Considered Options

- **`class HashableUri extends URI`** — rejected: VS Code's structured-clone RPC dropped the subclass, and `instanceof` is unreliable when each extension bundles its own `vscode-uri`. Structural `Equal`/`Hash` on `comparisonKey` is bundle-independent.
