---
name: wireit
description: Author and use Wireit scripts for npm. Use when working with Wireit configuration, npm scripts, build pipelines, or when the user mentions Wireit.
---

# Wireit

## Documentation

Full documentation: https://github.com/google/wireit

## Authoring Wireit Scripts

- Wireit is very static, list dependencies explicitly (won't infer them from npm workspace relationships).
- if something needs go (ex:compile) before another thing go (ex:bundle) that's a dependency
- envs: see https://github.com/google/wireit?tab=readme-ov-file#environment-variables
- deps can be relative ex "../../other-pkg:script-name"
- If a package in this repo has another package as a package.json dep or devDep, it should be a wireit dep for compile
- If an extension has another extension as an extensionDependency, it should be a wireit dep for bundle
  caching: if you specify `files` and `output` (even `[]`) you'll get caching (skips when neither have changed)
- You can have a wireit script without it being an npm script (ex: you can't execute it on its own, but it can run as a dep of another wireit script that can start from `npm run`)
- don't make circular references

## Using Wireit Scripts

- run commands with WIREIT_CACHE=none to avoid caching behaviors
- Agents should not run these (they won't exit)
  - any script with --watch
  - any `service:true` if you're an Agent, it won't exit
- wireit can't follow stuff that doesn't show up as changes that break the cache
  - manually changing code in node_modules then running compile or bundle
  - npm link'd packages (ex: symlinks to node libraries locally modified)

## Extra Arguments (passing CLI flags through wireit)

ref: https://github.com/google/wireit?tab=readme-ov-file#extra-arguments

- `npm run {script} -- {script args}` — single `--` forwards args to underlying command
- ex: `npm run build -- --verbose` passes `--verbose` to the command in `wireit.build.command`

## Common Patterns

top level `compile`, `lint`, `test` should run all of that in the various packages. When creating new packages, update these.

## Notes

each package will have its own `.wireit` cache, and there's also one at the top level.
