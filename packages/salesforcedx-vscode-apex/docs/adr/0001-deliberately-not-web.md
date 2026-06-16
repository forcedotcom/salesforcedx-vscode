# The apex extension is deliberately not web-enabled (Jorje never runs on web)

The in-repo Apex language support uses Jorje, a Java-based Apex language server that needs a JVM; a browser cannot host it, so `salesforcedx-vscode-apex` has no `browser` field and is a hard "never-web". This is why a web-compatible Apex LSP is shipped separately from the external [apex-language-support](https://github.com/forcedotcom/apex-language-support) repo rather than from this Jorje-based extension. See [external-consumers](../../../../.claude/skills/external-consumers/SKILL.md).
