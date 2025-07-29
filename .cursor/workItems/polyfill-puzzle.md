I'm trying to bundle a vscode extension for the web.

The polyfills and aliases are quite complex as various AI agents have attempted many solutions. Some of it might be unnecessary.

I did get the Services extension to load with the current setup and have a OrgBrowser test that starts the extension in vscode-test-web, then waits for the filesystem/project to load, then opens the OrgBrowser, where the failure happens.

`notificationsAlerts.ts:40 (FiberFailure) Error: Describe failed: TypeError: this.removeAllListeners is not a function`

That code comes from jsforce's connection and tooling modules, which use Cache to cache the describe. The Cache always returns a class that extends EventEmitter. Somehow, EventEmitter (node `events` module) is not getting properly polyfilled.

salesforce/core uses jsforce's `node` variant (`@jsforce/jsforce-node`) which is a simplified version of jsforce. I'm open to using that (instead of a bundle-time switch to jsforce), and having this repo provide the necessary polyfills.

Previous investigations have hinted that there's a conflict between the polyfill for `process` and the polyfill for `events` but I'm not 100% confident in that.

Any claims you make MUST be backed up by pointing to code in `browser.js` where something is not being polyfilled correctly. Don't guess or speculate. You have to be able to point to line numbers where the problem is definitely visible.

If you want to blame another library (jsforce, Effect, salesforce/core, etc) you must also be able to cite file+line and show how it's relevant to the error.

The bundle in question is in the services package. Most of the "services" are there, like jsforce,core Connection, etc. The "org-browser" package is trying to be lightweight on purpose.
