# polyfill puzzle 2

I'm trying to bundle a vscode extension for the web.

there are a LOT of polyfills in the scripts/bundling/web.mjs

Now that we have solid UI tests, I want to see how much of that we can eliminate and have the test still pass.

You can run the test via `npm run test:web -w salesforcedx-vscode-org-browser -- --grep=<testName>` (executed from the top of the salesforcedx-vscode project).

## List of aliases, polyfills, and plugins used in web.mjs

### Injected Files

1. processGlobalPath (process-global.js)
2. processPolyfillPath (process-polyfill.js)
3. bufferGlobalPath (buffer-global.js)

### Custom Plugins

4. pipeTransformPlugin (custom plugin to transform body.pipe() to browser-compatible pipeTo)
5. nodeModulesPolyfillPlugin (from 'esbuild-plugins-node-modules-polyfill')

### Define Values

6. process.env.SF_DISABLE_LOG_FILE: "'true'"
7. process.env.FORCE_MEMFS: "'true'"
8. global: 'globalThis'
9. \_\_dirname: '""'
10. \_\_filename: '""'

### Aliases

11. 'graceful-fs': '@salesforce/core/fs'
12. fs: '@salesforce/core/fs'
13. 'node:process': processPolyfillPath
14. 'node:fs': '@salesforce/core/fs'
15. 'node:fs/promises': '@salesforce/core/fs'
16. jsonwebtoken: 'jsonwebtoken-esm'
17. '@jsforce/jsforce-node': 'jsforce/browser'
18. '@jsforce/jsforce-node/lib': 'jsforce/browser'
19. process: processPolyfillPath
20. 'readable-stream': 'readable-stream'
21. 'node:path': 'path-browserify'
22. 'node:os': 'os-browserify'
23. 'node:buffer': 'buffer'
24. 'node:stream': 'stream-browserify'
25. 'node:util': 'util'
26. 'node:events': 'events'
27. events: 'events'
28. 'node:url': custom url-polyfill.js
29. 'node:crypto': 'crypto-browserify'
30. 'node:http': 'stream-http'
31. 'node:https': 'https-browserify'
32. 'node:querystring': 'querystring-es3'
33. 'node:assert': 'assert'
34. 'node:path/posix': 'path-browserify'
35. 'node:assert/strict': 'assert'
36. 'node-fetch': 'cross-fetch'
37. 'whatwg-url': 'url'

### Empty Polyfills

38. 'node:child_process': emptyPolyfillsPath
39. 'node:dns': emptyPolyfillsPath
40. 'node:net': emptyPolyfillsPath
41. 'node:tls': emptyPolyfillsPath
42. 'node:http2': emptyPolyfillsPath

### Standard Node.js Module Polyfills

43. path: 'path-browserify'
44. os: 'os-browserify'
45. buffer: 'buffer'
46. stream: 'stream-browserify'
47. util: 'util'
48. url: custom url-polyfill.js
49. crypto: 'crypto-browserify'
50. http: 'stream-http'
51. https: 'https-browserify'
52. querystring: 'querystring-es3'
53. assert: 'assert'
54. zlib: 'browserify-zlib'
55. timers: 'timers-browserify'
56. tty: 'tty-browserify'
57. string_decoder: 'string_decoder'
58. punycode: 'punycode'
59. domain: 'domain-browser'
60. constants: 'constants-browserify'
61. console: 'console-browserify'
62. vm: 'vm-browserify'
63. diagnostics_channel: 'diagnostics_channel'

### nodeModulesPolyfillPlugin Empty Modules

64. child_process: 'empty'
65. dns: 'empty'
66. net: 'empty'
67. tls: 'empty'
68. http2: 'empty'

### nodeModulesPolyfillPlugin Globals (disabled)

69. process: false
70. Buffer: false

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

- 38-42: 'node:child_process', 'node:dns', 'node:net', 'node:tls', 'node:http2'
- 64-68: child_process, dns, net, tls, http2 (nodeModulesPolyfillPlugin empty modules)

### Group 2: Likely Unused Node.js Modules

- 58: punycode
- 59: domain
- 60: constants
- 62: vm
- 63: diagnostics_channel
- 57: string_decoder
- 56: tty

### Group 3: Less Critical Browser Polyfills

- 55: timers
- 54: zlib
- 61: console
- 53: assert
- 33: 'node:assert'
- 35: 'node:assert/strict'
- 52: querystring
- 32: 'node:querystring'

### Group 4: Network-Related Polyfills (Test Carefully)

- 50: http
- 30: 'node:http'
- 51: https
- 31: 'node:https'
- 36: 'node-fetch'
- 37: 'whatwg-url'

### Group 5: Core Node.js Functionality (Most Critical)

- 43-49: path, os, buffer, stream, util, url, crypto
- 21-29: 'node:path', 'node:os', 'node:buffer', 'node:stream', 'node:util', 'node:events', 'node:url', 'node:crypto'
- 11-15: 'graceful-fs', fs, 'node:process', 'node:fs', 'node:fs/promises'
- 1-3: processGlobalPath, processPolyfillPath, bufferGlobalPath (injected files)

## Results Tracking

| Group   | Polyfills Removed | Test Result | Notes |
| ------- | ----------------- | ----------- | ----- |
| Group 1 |                   |             |       |
| Group 2 |                   |             |       |
| Group 3 |                   |             |       |
| Group 4 |                   |             |       |
| Group 5 |                   |             |       |
