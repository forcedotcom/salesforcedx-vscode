# simplified packaging process

Some extensions use vsce-bundled-extension. It modifies pjson during build time, builds in temp dirs, re-runs npm install.

It also changes `cwd` so that it has to be run 1 package at a time.

It does a npm install (--production) and causes you to have to run npm install again to get your devDependencies back in node modules.

In other words, it's a pain.

It explicitly lists which files get into the package.

---

Newer extensions use `vsce package` directly and can be packaged in parallel.

You can .vscodeignore anything that you **don't** want in the package.

See [simplify-packaging-org-ext.md](../../.cursor/plans/simplify-packaging-org-ext.md) for details on migrating.

---
