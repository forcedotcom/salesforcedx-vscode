# Polyfills

This a vscode extension that needs to run on desktop and web.

It needs to use some libraries (salesforce/core, salesforce/source-deploy-retrieve) which are written for node.

I need to polyfill the `node:` stuff.

It's been hard. Was trying to use esbuild, and ran into issues with the `events` polyfill conflicting with `process`. The 2 esbuild polyfill plugins were somewhat dated.

Relevant extensions are salesforcedx-vscode-services
Also tried webpack since that's what some other projects are using. Have had errors on that too.

What do you recommend?

- What are most vscode-for-the-web extensions doing?
- esbuild vs. webpack?
- how are people handling node polyfills?
