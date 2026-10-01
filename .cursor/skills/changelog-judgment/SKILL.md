---
name: changelog-judgment
description: Turn changelog facts into changelog sections JSON. The changelog body script is the only caller.
disable-model-invocation: true
---

# Changelog judgment

Reply with one JSON object and no other text. No markdown fences.

Keys, each an array: `Added`, `Fixed`, `Changed`, `Under the Hood`.

Each element: `pr` (number), `sentence` (string), and `package` (string). Omit `package` on `Under the Hood` elements.

Every fact `pr` appears once, in exactly one array. `package` is one of that fact's `packages`. A fact with an empty `packages` array goes in `Under the Hood`.

`sentence` is one or two sentences for a customer:

- Start with `We added`, `We fixed a bug where`, `We improved`, `We reverted`, or `The <X> now`. End with `.`
- Bold user-facing names. Backtick code identifiers, file names, and config keys.
- Describe what the user can do, not the implementation.
- `Added` is new capability. `Fixed` is a bugfix. `Changed` is a behavior change of something that already existed. `Under the Hood` is invisible to users (telemetry, refactor, CI, bundle size, internal API). A `perf` fact is `Under the Hood` unless a user would notice the speedup.
- Prefer `VS Code`. Say `on Windows`.
