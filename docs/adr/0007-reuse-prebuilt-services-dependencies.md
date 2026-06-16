# Reuse `prebuiltServicesDependencies`, never `.Default` a prebuilt service

A consumer composes its Effect layer from `api.services.prebuiltServicesDependencies` (via `Layer.succeedContext`) and must not add `SomeService.Default` for a service already in that context. Rebuilding constructs a second singleton with its own watchers/caches/org references — it still compiles, which is why it is the most common consumption mistake. See the [services-extension-consumption skill](../../.claude/skills/services-extension-consumption/SKILL.md).
