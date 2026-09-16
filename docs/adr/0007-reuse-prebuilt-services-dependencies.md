# Reuse `prebuiltServicesLayer`, never `.Default` a prebuilt service

Do not `.Default` a service already in `api.services.prebuiltServicesLayer`. Rebuilds a second singleton (caches/watchers/org refs) — still compiles, most common consumption mistake.

`prebuiltServicesDependencies` is the deprecated Context-only field (no FiberRefs). `prebuiltServicesLayer` adds the redacting-logger FiberRef, not the OTEL tracer — consumers add `SdkLayerFor`.

See [services-extension-consumption](../../.claude/skills/services-extension-consumption/SKILL.md).
