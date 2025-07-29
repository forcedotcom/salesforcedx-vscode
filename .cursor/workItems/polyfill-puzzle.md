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

We've made significant progress in resolving the polyfill issues:

1. Fixed stream duplication by adding a direct alias for `readable-stream` in `web.mjs`
2. Fixed process polyfill injection by adding the correct `inject` array in `web.mjs`
3. Fixed `process.nextTick` implementation to properly pass arguments to callbacks

The original stream errors (`Cannot read properties of undefined (reading 'read')`) have been resolved. The error was occurring in the `nReadingNextTick` function in `_stream_readable.js` when it tried to call `self.read(0)`, but `self` was undefined because our `process.nextTick` implementation wasn't properly passing arguments to the callback.

### Current Error

Now we're getting an authentication-specific error:

```
RefreshTokenAuthError: Error authenticating with the refresh token due to: grant type not supported
```

This is not a polyfill issue but rather an authentication flow issue. The auth flow is working correctly up to the point where it tries to use the refresh token, but the OAuth2 server is rejecting the grant type.

### Root Cause Identified

1. **Stream Duplication**: The bundle contained multiple copies of `readable-stream` from different `node_modules` paths, creating separate instances with different prototypes.
2. **Process.nextTick**: The implementation in `process-polyfill.js` wasn't preserving arguments passed to callbacks:

   ```javascript
   // Incorrect implementation
   const nextTick = callback => setTimeout(callback, 0);

   // Fixed implementation
   const nextTick = (callback, ...args) => setTimeout(() => callback(...args), 0);
   ```

### Next Steps

1. Investigate the OAuth2 authentication error
2. Check if the original `removeAllListeners` error is still present but masked by the auth errors
