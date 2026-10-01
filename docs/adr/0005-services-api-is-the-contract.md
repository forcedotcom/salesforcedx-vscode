# The services extension API is the contract for new code

New cross-extension functionality (get a connection, deploy, read config) goes through the `salesforcedx-vscode-services` API obtained via `getServicesApi`/`ExtensionProviderService`, not by importing libraries directly into each extension. This is the web-compatible target and the single place shared stateful services live. See [CodeReuse.md](../architecture/CodeReuse.md) and the [services-extension-consumption skill](../../.claude/skills/services-extension-consumption/SKILL.md).
