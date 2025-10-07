# Requirements

* Node 8+
* NPM 4+

# Installation

Before doing anything, make sure you have configure `npm` to download packages from Nexus. If it's not the case, follows the steps in this document: https://sfdc.co/npm-nexus.

```sh
npm install                 # Install necessary packages
npm run build               # Compile typescript code to javascript
npm test                    # Run the test
npm test -- --watch         # Run the test in watch mode
```

# Running

See [Setup Development Environment](https://github.com/forcedotcom/lightning-language-server/blob/develop/README.md#setup-development-environment)

# Rebuilding after changes
1. Stop salesforcedx-vscode
2. Rebuild aura-language-server (CMD+SHIFT+B)
3. Relaunch salesforcedx-vscode
4. Re-attach aura-language-server debugger

Test GPG