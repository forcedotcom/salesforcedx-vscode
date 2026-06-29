# salesforcedx-vscode-org Context

## Glossary

### deletable org

- = scratch org or sandbox (the only org types `sf org delete` removes)
- production / Dev Hub / non-scratch-non-sandbox defaults are NOT deletable
- derived from default org snapshot: `isScratch || isSandbox`

### default org

- the `target-org` config value; tracked in services `TargetOrgRef` (`DefaultOrgInfoSchema`)
- snapshot carries `isScratch?` / `isSandbox?` (services `connectionService` writes both)

### sf:default_org_deletable (context key)

- VS Code context key set by services `updateContext` (context.ts) on each default-org change
- `true` when default org `isScratch || isSandbox`, else `false`
- gates the `sf.org.delete.default` command-palette `when` clause — command hidden for non-deletable defaults
- `sf.org.delete.username` (picker) is NOT gated by this key

### sf.org.delete.default vs sf.org.delete.username

- `sf.org.delete.default` → Effect `orgDeleteDefaultCommand` (no picker; confirm modal; `org delete sandbox` for sandbox else `org delete scratch`)
- `sf.org.delete.username` → Effect `orgDeleteUsernameCommand` (multi-select `gather` picker + confirm; per-org `sf org delete scratch|sandbox --target-org <u>` via `TerminalService.simpleExec`; continues past a failed org via `Effect.either`, then fails `OrgDeleteFailedError` if any failed). CLI removes auth + aliases + unsets config, so no separate cleanup.
