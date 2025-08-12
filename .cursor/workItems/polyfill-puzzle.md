# polyfill puzzle 2

I'm trying to bundle a vscode extension for the web.

there are a LOT of polyfills in the scripts/bundling/web.mjs

Now that we have solid UI tests, I want to see how much of that we can eliminate and have the test still pass.

You can run the test via `npm run test:web -w salesforcedx-vscode-org-browser -- --grep=<testName>` (executed from the top of the salesforcedx-vscode project).

After removing an item, run the test then update this doc with the result (can it be safely removed or not). If it can't be removed, be sure to put it back before proceeding to the next item.

Feel free to try multiple items at a time if it's more efficient, you can always go back and do them individually if it's not clear what broke the test.

Be sure to increment timestamps in the extensions if necessary to ensure non-cached builds. You can tell from the build output of `bundle:extension` that they rebuilt the dist.

If something can be removed ok, once it's out, do a git commit `fix: remove [foo]` to record it

## List of aliases, polyfills, and plugins used in web.mjs

### Injected Files

1. processGlobalPath (process-global.js) ❌ REQUIRED
2. processPolyfillPath (process-polyfill.js) ✅ REMOVED - Test passes
3. bufferGlobalPath (buffer-global.js) ❌ REQUIRED - "Buffer is not defined" error

### Custom Plugins

4. pipeTransformPlugin (custom plugin to transform body.pipe() to browser-compatible pipeTo) ✅ REMOVED - Test passes
5. jszipNodestreamTransformPlugin (custom plugin) ✅ REMOVED - Test passes
6. nodeModulesPolyfillPlugin (from 'esbuild-plugins-node-modules-polyfill') ❌ REQUIRED

### Define Values

8. global: 'globalThis'
9. \_\_dirname: '""'
10. \_\_filename: '""'

### Empty Polyfills

11. 'node:child_process': emptyPolyfillsPath
12. 'node:dns': emptyPolyfillsPath
13. 'node:net': emptyPolyfillsPath
14. 'node:tls': emptyPolyfillsPath
15. 'node:http2': emptyPolyfillsPath
16. got: emptyPolyfillsPath

### Standard Node.js Module Polyfills

17. path: 'path-browserify'
18. os: 'os-browserify'
19. buffer: 'buffer'
20. stream: 'readable-stream'
21. util: 'util'
22. url: custom url-polyfill.js
23. crypto: 'crypto-browserify'
24. http: 'stream-http'
25. https: 'https-browserify'
26. querystring: 'querystring-es3'
27. assert: 'assert'
28. zlib: 'browserify-zlib'
29. timers: 'timers-browserify'

### nodeModulesPolyfillPlugin Empty Modules

30. child_process: 'empty'
31. dns: 'empty'
32. net: 'empty'
33. tls: 'empty'
34. http2: 'empty'

### nodeModulesPolyfillPlugin Globals (disabled)

35. process: false
36. Buffer: false

## Testing Strategy for Removing Polyfills

1. Create a baseline by running the tests first to ensure they pass with all current polyfills:

   ```
   npm run test:web -w salesforcedx-vscode-org-browser
   ```

2. Try removing polyfills in groups based on their likely importance:

   - Start with empty polyfills (38-42, 64-68) as they're already stubbed
   - Try removing standard Node.js modules that might not be used (like vm, punycode, etc.)
   - Test more critical polyfills last (fs, process, buffer)

3. After each removal:

   - Update web.mjs
   - Run `npx lerna run bundle:extension` to rebuild
   - Run the tests to see if they still pass

4. Document each successful removal and any failures for future reference

## Prioritized List of Polyfills to Try Removing

### Group 1: Already Empty Polyfills (Likely Safe to Remove)

- 11-15: 'node:child_process', 'node:dns', 'node:net', 'node:tls', 'node:http2' ❌ REQUIRED - Build fails without them
- 16: got ❌ REQUIRED - Build fails without it
- 30-34: child_process, dns, net, tls, http2 (nodeModulesPolyfillPlugin empty modules) ❌ REQUIRED - Build fails without them

### Group 2: Likely Unused Node.js Modules (All Successfully Removed)

- punycode ✅ REMOVED - Test passes
- domain ✅ REMOVED - Test passes
- constants ✅ REMOVED - Test passes
- vm ✅ REMOVED - Test passes
- diagnostics_channel ✅ REMOVED - Test passes
- string_decoder ✅ REMOVED - Test passes
- tty ✅ REMOVED - Test passes

### Group 3: Less Critical Browser Polyfills

- 29: timers ❌ REQUIRED - Build fails without it (jsforce/xml2js needs it)
- 28: zlib ❌ REQUIRED - Needed by decompress-response when got is removed, restored
- console ✅ REMOVED - Not in current config
- 27: assert ❌ REQUIRED - Build fails without it (@salesforce/core needs it)
- 26: querystring ❌ REQUIRED - Build fails without it (jsforce needs it)

### Group 4: Network-Related Polyfills (Test Carefully)

- 24: http ❌ REQUIRED
- 25: https ❌ REQUIRED
- 'node-fetch' ✅ REMOVED - Test passes
- 'whatwg-url' ✅ REMOVED - Test passes
- events ✅ REMOVED - Test passes (non-prefixed version)

### Group 5: Core Node.js Functionality (Most Critical)

- 42-48: path, os, buffer, stream, util, url, crypto ❌ REQUIRED
- 22, 25-28, 30-31: 'node:path', 'node:os', 'node:buffer', 'node:stream', 'node:util', 'node:url', 'node:crypto' ❌ REQUIRED
- 11-19: jszip, fs polyfills, jsforce redirects, process ❌ REQUIRED
- 1, 3: processGlobalPath, bufferGlobalPath (injected files) ❌ REQUIRED
- 2: processPolyfillPath ✅ REMOVED

## Post-completion

If we removed anything from alias/polyfills that's in package.json and no longer needed, let's take it out of there, too.
If we remove plugins, make sure their code is removed.
