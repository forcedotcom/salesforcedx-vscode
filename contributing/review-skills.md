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

Independent of `review` eligibility and invocation controls; preserve those fields. Covers `review: always`, skills selected by the legacy `review-diff` / `adopt-pr` workflows, and other PR-review skills, including flat Markdown skills. Some legacy selections have `review: never`; complexity metadata does not change that policy.

Keep concrete model names out of skills. Model routing is outside this metadata's scope.
