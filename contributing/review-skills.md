# Review skill complexity

Top-level YAML frontmatter on repository skills used for PR review:

```yaml
review-complexity: medium
```

Minimum recommended model capability for applying the skill, not reduced review rigor. All levels require the full skill's checks and evidence. Classify by required reasoning, not skill length or diff size.

| Value | Required reasoning |
| --- | --- |
| `low` | Explicit, mostly file-local rules. Examples: `packageJson`, `concise`. |
| `medium` | Trace behavior, callers, tests, and edge cases across files. |
| `high` | Cross-package contracts, lifecycle/concurrency, compatibility, or architectural judgment. Examples: `services-extension-consumption`, `thermonuclear-code-quality-review`. |

Choose the highest level of reasoning the skill requires.

Use on PR-review skills, including flat Markdown skills. Omit `review-complexity` for `review: never`, even if a legacy workflow selects the skill. Preserve `review` and invocation controls.

Keep concrete model names out of skills. Model routing is outside this metadata's scope.
