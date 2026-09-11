status: invalid
why: `Effect.void` produces `void | Uri`, not `URI | undefined`; the cited rule limits `Option<T>` to domain types, while this is a local variable.
## Effect review — diff

### should
- [packages/salesforcedx-vscode-core/src/commands/openDocumentation.ts:26-32](../../../packages/salesforcedx-vscode-core/src/commands/openDocumentation.ts#L26-L32) — `NoActiveEditorError` is intentionally recovered as `Effect.void`, creating an untyped `URI | undefined` sentinel consumed via optional chaining and `Match.undefined`. Preserve the typed absence with `Effect.map(Option.some)` and `Effect.catchTag('NoActiveEditorError', () => Effect.succeed(Option.none()))`, then dispatch with `Option.match`; `EditorService.getActiveEditorUri` has exactly this tagged no-editor failure ([editorService.ts:33-39](../../../packages/salesforcedx-vscode-services/src/vscode/editorService.ts#L33-L39)), while the Effect rules require `Option<T>` rather than raw nullability for missing values ([effect-best-practices:42-43](../../../.claude/skills/effect-best-practices/SKILL.md#L42-L43)).

Verdict: minor
