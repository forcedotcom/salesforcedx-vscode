I'm trying to bundle a vscode extension for the web.

The polyfills and aliases are quite complex as various AI agents have attempted many solutions. Some of it might be unnecessary.

I did get the Services extension to load with the current setup and have a OrgBrowser test that starts the extension in vscode-test-web, then waits for the filesystem/project to load, then opens the OrgBrowser, where the failure happens.

`notificationsAlerts.ts:40 (FiberFailure) Error: Describe failed: TypeError: this.removeAllListeners is not a function`

That code comes from jsforce's connection and tooling modules, which use Cache to cache the describe. The Cache always returns a class that extends EventEmitter. Somehow, EventEmitter (node `events` module) is not getting properly polyfilled.

salesforce/core uses jsforce's `node` variant (`@jsforce/jsforce-node`) which is a simplified version of jsforce. We want to use this (may require polyfills) and not the full jsforce.

Previous investigations have hinted that there's a conflict between the polyfill for `process` and the polyfill for `events` but I'm not 100% confident in that.

Any claims you make MUST be backed up by pointing to code in `browser.js` where something is not being polyfilled correctly. Don't guess or speculate. You have to be able to point to line numbers where the problem is definitely visible.

If you want to blame another library (jsforce, Effect, salesforce/core, etc) you must also be able to cite file+line and show how it's relevant to the error.

The bundle in question is in the services package. Most of the "services" are there, like jsforce,core Connection, etc. The "org-browser" package is trying to be lightweight on purpose.

currently, salesforce/core is npm-linked. If you do any `npm install` you'll need to run `npm link @salesforce/core` afterward.

Please do not change code in the services package (exception: debug-only changes are allowable). This is a polyfill problem, not a services problem.

## Investigation Progress

### Current Status (2025-01-29)
The original `removeAllListeners` error has been masked by stream-related errors that occur during authentication. The extension now fails with stream errors like `Cannot read properties of undefined (reading 'read')`.

### Root Cause Identified
The bundle contains **three separate copies** of `readable-stream` from different `node_modules` paths, creating three separate `require_stream_readable` variables. When different parts of the code try to use `readable-stream`, they get different instances with different prototypes, causing the stream errors.
