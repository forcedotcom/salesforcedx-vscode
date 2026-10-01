# Errors flow through Effect channels, not throw/try-catch

Failures are modeled as `Schema.TaggedError` on the Effect error channel — one tagged error per failure mode — rather than thrown exceptions or defensive `try`/`catch`. Catch only to ignore a failure deliberately or to improve a message; speculative `try`/`catch` swallows failures and breaks span/telemetry attribution. See [effect-best-practices](../../.claude/skills/effect-best-practices/SKILL.md) and [ts4023-effect-errors](../../.claude/skills/ts4023-effect-errors/SKILL.md).
