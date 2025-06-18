# new bundling checklist

## package.json

- main should point to dist/index.js
- types should point to out/src/index.js (if an only if the extension exports its API to be consumed by other extensions like Core and Apex ext do).
- vscode:package should just run `vsce package`.
- update the bundle script for the new .mjs esbuild file
- remove any `packaging` content
- remove the prepublish script
- are the bundle:copy scripts? let's do that in the esbuild file

## esbuild.config

- use mjs, not cjs
- use modern esm syntax (import, not require)
- include the pino stuff only if it includes sfdx-core somewhere

## .vscodeignore

- make sure node_modules is completely ignored

## TODO

---

## POST

when complete, remove the concurrency=1 from the top-level package script
update the "launch extensions" task to do bundle (which will do compile)
remove the vsce-bundled-extensions script (it should be unused at that point)
