---
name: Package JSON ESLint Rules
overview: "Create three new ESLint rules for VS Code extension package.json validation: icon path validation, menu command reference validation, and view ID reference validation."
todos:
  - id: icon-paths-rule
    content: Create packageJsonIconPaths rule (light/dark pairs, file existence)
    status: pending
  - id: command-refs-rule
    content: Create packageJsonCommandRefs rule (menu refs, orphan detection)
    status: pending
    dependencies:
      - icon-paths-rule
  - id: view-refs-rule
    content: Create packageJsonViewRefs rule (when clause view IDs)
    status: pending
    dependencies:
      - command-refs-rule
  - id: wire-up
    content: Export rules in index.ts and enable in eslint.config.mjs
    status: pending
    dependencies:
      - view-refs-rule
---

# VS Code Extension package.json ESLint Rules

Three new rules for [`packages/eslint-local-rules/src/`](packages/eslint-local-rules/src/):

## Rule 1: Icon Path Validation (`packageJsonIconPaths`)

**Checks:**

- Icon objects have both `light` and `dark` properties (or neither)
- Paths follow consistent pattern (`resources/light/*.svg`, `resources/dark/*.svg`)
- Referenced icon files exist on disk

**Locations to check:**

- `contributes.commands[*].icon`
- `contributes.viewsContainers.activitybar[*].icon`
- `contributes.menus.*.icon` (if any)

---

## Rule 2: Menu Command References (`packageJsonCommandRefs`)

**Checks:**

- Commands referenced in menus exist in `contributes.commands`
- Commands defined in `contributes.commands` are used somewhere (orphan detection)

**Menu locations:**

- `contributes.menus.view/title[*].command`
- `contributes.menus.view/item/context[*].command`
- `contributes.menus.editor/context[*].command`
- `contributes.menus.explorer/context[*].command`
- `contributes.menus.commandPalette[*].command`

---

## Rule 3: View ID References (`packageJsonViewRefs`)

**Checks:**

- View IDs in `when` clauses (`view == someId`) match defined views
- Views defined in `contributes.views` are referenced somewhere

**View definitions:** `contributes.views.*[*].id`

**View references in `when` clauses:**

- `contributes.menus.view/title[*].when`
- `contributes.menus.view/item/context[*].when`
- `contributes.viewsWelcome[*].view`

---

## Implementation Approach

Reuse the JSON AST traversal pattern from [`packageJsonI18nDescriptions.ts`](packages/eslint-local-rules/src/packageJsonI18nDescriptions.ts) - specifically `findNodeAtPath()` and the path matcher pattern.

**Files to create:**

- `packages/eslint-local-rules/src/packageJsonIconPaths.ts`
- `packages/eslint-local-rules/src/packageJsonCommandRefs.ts`
- `packages/eslint-local-rules/src/packageJsonViewRefs.ts`

**Files to modify:**

- [`packages/eslint-local-rules/src/index.ts`](packages/eslint-local-rules/src/index.ts) - export new rules
- [`eslint.config.mjs`](eslint.config.mjs) - enable rules for package.json files