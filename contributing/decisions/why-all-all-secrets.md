`vsce package --allow-package-all-secrets`

vsce does a secret scan
it tries to use `secretlint` pkg
which doesn't support npm workspace monorepo (it really wants node_modules in the same folder as what's being packaged) and fails like this on `3.6.0` because of esm/import/eval

` ERROR  Cannot find package '@secretlint/node' imported from /Users/shane.mclaughlin/eng/forcedotcom/alt-vscode/node_modules/@vscode/vsce/out/secretLint.js
      npm error Lifecycle script`vscode:package` failed with error:`

references

- https://github.com/Silic0nS0ldier/vscode-git-monolithic-extension/pull/127/files
- https://github.com/microsoft/vscode-vsce/issues/1154

---

pinned back on `3.5.0` you'll also see annoying false positives like
` found Sendgrid api key: SG.promises.mkdir [sendgrid]
dist/web/index.js#1179:17791-1179:17808

        found Sendgrid api key: SG.promises.rm [sendgrid]
        dist/web/index.js#1179:17978-1179:17992

`

OH NOES, minified code has something that uses `SG*` in it. This started showing up when minification was put in.

We have enough secret scanners already in place to disable this one.
