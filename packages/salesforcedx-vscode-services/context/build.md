# Build

We'll compile from /src to /out
We'll bundle, using esbuild, from /out to /dist/index.js for desktop
We'll bundle, using esbuile, from /out to /dist/browser.js for web

No `external` allowed for esbuild. Everything will
esbuild file should be .mjs and use ESM.

We'll import from @salesforce/core and other libraries, not the bundled versions

## Bundling

1. no libraries need to publish bundles
1. all bundling happens here in the extensions repo during build-time
1. non-extensions (ex: `*-utils`, LSs, debuggers, `faux-generator`) do not bundle
1. bundles are created from compiled js code (`out/src`), not from src [this is worth reconsidering. It's relatively cheap given `nx` cache, and can be useful for transformations and replacements].
1. bundles create the `dist` folder
1. everything the extension needs should be in `dist`. There can be multiple files.
1. [cross-package dependencies](#cross-package-dependencies) are bundled by the consumer's bundle step, not an intermediate bundle step
1. extensions say their `main` is the bundled `/dist/index.js` and not compiled code from `out`
