---
name: i18n-messages
description: Editing extension i18n message files and their consumers. Use when editing packages/*/src/messages/i18n.ts, adding/changing nls.localize strings, or choosing placeholder tokens (%s/%d/...).
---

# i18n Messages

Scope: `packages/*/src/messages/i18n.ts` + code consuming those messages via `nls.localize`. NOT `package.json`/`package.nls.json` nls strings (command titles etc.), NOT unrelated code.

## Placeholder semantics

`nls.localize(key, ...args)` substitutes via `node:util.format` — `packages/salesforcedx-vscode-i18n/src/i18n/message.ts:50` (`return format(possibleLabel, ...labelArgs)`).

| Token | Use | Behavior (`node:util.format`) |
|---|---|---|
| `%s` | string | string |
| `%d` | count/number | number as-is (`3.7`→`3.7`, no truncation) |
| `%i` | integer | truncates float (`3.7`→`3`) |
| `%f` | float | float |
| `%j` | value | JSON |
| `%o` `%O` | value | inspected object |
| `%c` | — | CSS directive, no output |
| `%%` | literal `%` | `%` only when args present; bare string keeps `%%` |
| `%n` | NONE | unsupported — renders literal `%n`, NOT substituted |

Default: counts → `%d`, strings → `%s`. (Origin: `Removed %n orgs` shipped literal `%n`.)

### Arg-count gotcha

`message.ts:39` counts specifiers with `/%[sdifj%]/g` (`%%` excluded, L40). On mismatch it logs and trims extra args (L41-48); missing args are NOT filled — trailing unmatched tokens render literally.

- `%o` `%O` `%c` substitute at runtime but are NOT in that regex → they escape arg-count validation. Avoid relying on them; prefer `%s`/`%d`/`%j`.
- `%n` is not counted and not a real token → expected-count is off by what you intended and the `%n` prints literally.

## Reuse first

Before adding a string, `grep` `package.nls.json` for an existing equivalent and reuse it. Don't duplicate.

## Per-surface style

Empirical, from `salesforcedx-vscode-org` (`src/messages/i18n.ts`, `package.nls.json`):

| Surface | Example | Cap | Punctuation |
|---|---|---|---|
| Command title (`package.nls.json` `*_text`) | `SFDX: Create a Default Scratch Org...` | Title Case, `SFDX:` prefix | none (`...` ok for further input) |
| QuickPick/InputBox placeholder | `i18n.ts:72` `Select scratch orgs and sandboxes to delete` | sentence | none |
| Confirm prompt | `i18n.ts:73` `Permanently delete %d org(s)? This cannot be undone.` | sentence | terminal `.`/`?` |
| Notification (`show*Message`) | `i18n.ts:100` `... orgs expire in the next %d days. ...` | sentence | terminal `.` |
| Button/action label | `i18n.ts:74,75` `Delete`, `Logout` | Title Case | none |
| Tree/status-bar label+tooltip | `i18n.ts:103` `Open Default Org in Browser` | Title Case | none |
| Log/channel line | — | sentence | `.` |
| Validation error | — | sentence | terminal `.` |

## No severity prefix

Don't prefix new strings with `Error:`/`Warning:` — the `show*Message` API supplies severity. `i18n.ts:100` (`Warning: One or more...`) is a legacy anti-pattern; don't copy it, and don't edit it (out of scope). See `vscode-window-messages`.

## Cross-ref

`vscode-window-messages` covers the notification/button API (which `show*Message`, return values, Effect, modal). This skill is the message *text*. Don't duplicate API guidance here.
