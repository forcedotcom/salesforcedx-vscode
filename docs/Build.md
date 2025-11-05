# Build

## Open Source

You should plan to publish your extension in a public, OSS repo. Remember `.vsix` format is basically a zip file and people can inspect your code (and un-minify it) whether its in a public repo or not, so no secrets are possible.

## Conventions

follow the code structure of this repo
/src (.ts)
/out (compiled source, will be .js and .d.ts)
/dist (bundled source)

## Lerna

This repo uses lerna/nx. It's ok, you don't have to use it if it's not necessary

## Versioning

This repo has a consistent version across all extensions and packages. You don't need to do that, we probably stop doing that eventually.

## Bundling

VSCode strongly recommends bundling your code (taking tons of js files and node_modules and outputting a single minified file). This repo uses [esbuild](https://esbuild.github.io/) and you probably should too.

We bundle from compiled, not source. This allows for TS transformations and simplifies debugging.

When you add a dependency, run the bundling process to make sure that your dep is bundleable. If your extension is desktop-only, you **can** put unbundleable dependencies in `external` property of the esbuild config which tells esbuild to not bundle that (ship it "as is" in node_modules). This can make extensions really big, and is not possible at all on the web.

## Package

model your code after packages in this repo who use `vsce package` and NOT [/scripts/vsce-bundled-extension.ts](../scripts/vsce-bundled-extension.ts)
You'll need a `.vscodeignore` file (to keep unwanted code out of the package)
your project should not have a `packaging` stanza in package.json (package-time modification)

This will generate vsix. Use those for manual QA and for your end-to-end tests to prevent "works on my machine" but some bundling/packaging configuration messes it up.

## Publish

To publish, you'll need a publish token shared with your repo. At a minimum, you'll want to publish your extension to Microsoft's vscode marketplace. We also publish extensions to the [openVsx](https://open-vsx.org/) registry.

## See Also

- [Testing](./Testing.md) - use vsix packages for e2e tests
- [contributing/publishing.md](../contributing/publishing.md) - detailed publishing process for this repo
