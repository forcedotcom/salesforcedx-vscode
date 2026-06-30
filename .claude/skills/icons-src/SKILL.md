---
name: icons-src
description: Add custom SVG icons to salesforcedx-vscode-services for font generation. Use when adding new icons to media/icons-src, creating SVG icons for VS Code extension, or defining font-based icons.
---

# Icons-src: Adding Custom Font Icons

## Location

`packages/salesforcedx-vscode-services/media/icons-src/`

## SVG Requirements

- **viewBox**: `0 0 24 24` only (enables better upscaling)
- **xmlns**: `http://www.w3.org/2000/svg`
- **fill**: `currentColor` on inner `<g>` so VS Code themes control color
- **structure**: wrap paths in `<g fill="currentColor" transform="scale(X)">` — adjust scale so glyph fits 24×24

External sources (Wikipedia, Illustrator, etc.) may be too complex for font generation. Simplify in vector editor or substitute alternative.

### Reference (leaf.svg)

```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g fill="currentColor" transform="scale(0.75)">
    <path d="..."></path>
  </g>
</svg>
```

### Avoid

- Hardcoded fill colors (e.g. `fill="#000"`) — breaks theme support
- viewBox other than 24×24
- Strokes without `stroke="currentColor"` if used

## Workflow

1. **Add SVG** — `media/icons-src/<name>.svg` (name = lowercase, no spaces). Done: file matches [SVG Requirements](#svg-requirements)
2. **Add manifest entry** — append to `media/icons-src/icons.json` per [icons.json Format](#iconsjson-format). Done: key + `id` + `description` present
3. **Run build** — `npm run build:icons -w salesforcedx-vscode-services`. Done: auto-generated artifacts updated — verify `git diff` (see [Artifacts](#artifacts-that-change-addremove))
4. **Add ICONS constant** — `src/vscode/mediaService.ts`: `ICONS` + `ICON_DESCRIPTION_KEYS`; add i18n key in messages if needed. Done: new icon in both maps, compiles
5. **Regenerate types** — if services-types consumes ICONS, run its generate script. Done: `icons.ts` includes new icon

## icons.json Format

```json
{
  "leaf": { "id": "sf-org-leaf", "description": "Leaf icon for default scratch org" },
  "tree": { "id": "sf-org-tree", "description": "Tree icon for default dev hub" }
}
```

- **Append** new icons (order affects `0xe001`, `0xe002`, … code point assignments)
- Key = SVG filename without `.svg`
- `id` = VS Code icon ID (use `sf-org-*` for custom icons)
- `description` = human-readable, used in contributes.icons

## Artifacts that change (add/remove)

| Artifact                                                        | Add                      | Remove       |
| --------------------------------------------------------------- | ------------------------ | ------------ |
| `media/icons-src/<name>.svg`                                    | create                   | delete       |
| `media/icons-src/icons.json`                                    | add entry                | remove entry |
| `package.json` → `contributes.icons`                            | auto (build:icons)       | auto         |
| `resources/icons-font/*`                                        | auto (build:icons)       | auto         |
| `src/vscode/mediaService.ts` → `ICONS`, `ICON_DESCRIPTION_KEYS` | manual                   | manual       |
| `src/messages/*` (i18n)                                         | manual if needed         | manual       |
| `salesforcedx-vscode-services-types` (icons.ts)                 | manual (generate script) | manual       |

## Verification

Run `npm run test -w salesforcedx-vscode-services` — `iconConsistency.test.ts` validates SVG ↔ icons.json ↔ contributes.icons ↔ ICONS constant.
