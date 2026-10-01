---
name: vscode-elements-webviews
description: Integrate @vscode-elements/elements controls into Lit webviews. Use when adding or changing VSCode Elements selects, text fields, checkboxes, buttons, form association, controlled values, accessibility state, or VS Code theme styling.
review: never
---

# VSCode Elements in Lit webviews

Wrapper component = adapter between application state and the VSCode Elements public API.

## Imports and controlled state

- Concrete module imports: `@vscode-elements/elements/dist/<element>/index.js`. Class import when narrowing `currentTarget`; side-effect import when only registration is needed.
- Controlled state through public `.value`, `.checked`, `.invalid`, and `?disabled` properties.
- `change`, `input`, and `click` events translated to schema-backed application actions; `currentTarget` narrowed with the concrete element class.
- Slotted option changes clearing a select's pending value: await nested `updateComplete` in `updated()`, then reapply the controlled value.
- No private control fields.

## Form association

VSCode Elements inputs use `ElementInternals`; a child Lit shadow root can block discovery of a parent-rendered form.

- Outer-form participation required: `createRenderRoot()` returns `this`, with rationale comment.
- Otherwise: normal shadow DOM. Light DOM is a targeted interop choice, not a component default.
- Real-browser assertion for the resulting `control.form` relationship.

## Accessibility

- Host-supplied localized labels; semantic `<label for>` plus the control's public `label` where required.
- Loading, invalid, disabled, empty, and no-match states via accessible attributes or live status text—not color alone.
- Public host attributes first. When the accessible node is internal and host attributes do not propagate: smallest possible wrapper-local sync adapter, after nested `updateComplete`.
- Shadow-root knowledge confined to that adapter and targeted low-level test helpers.

## Styling

- Public `--vscode-*` tokens for colors, borders, focus, and typography; spacing consistent with VS Code controls.
- No assumption that styles cross a VSCode Elements shadow boundary. Third-party content themed separately with the same tokens.

Examples: `packages/soql-builder-ui/src/components/soqlFromElement.ts`, `packages/soql-builder-ui/src/components/soqlFieldsElement.ts`.
