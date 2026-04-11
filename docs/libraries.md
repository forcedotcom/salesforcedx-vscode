# Working with Libraries

This project depends on several Salesforce libraries. To develop or debug against local changes in those libraries, use the workflow below.

## Libraries Used

| Package                                                                                     | Repo                                                                                        | npm                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [@salesforce/source-deploy-retrieve](https://github.com/forcedotcom/source-deploy-retrieve) | [forcedotcom/source-deploy-retrieve](https://github.com/forcedotcom/source-deploy-retrieve) | [@salesforce/source-deploy-retrieve](https://www.npmjs.com/package/@salesforce/source-deploy-retrieve) |
| [@salesforce/core](https://github.com/forcedotcom/sfdx-core) (sfdx-core)                    | [forcedotcom/sfdx-core](https://github.com/forcedotcom/sfdx-core)                           | [@salesforce/core](https://www.npmjs.com/package/@salesforce/core)                                     |
| [@salesforce/source-tracking](https://github.com/forcedotcom/source-tracking)               | [forcedotcom/source-tracking](https://github.com/forcedotcom/source-tracking)               | [@salesforce/source-tracking](https://www.npmjs.com/package/@salesforce/source-tracking)               |
| [@salesforce/apex-node](https://github.com/forcedotcom/salesforcedx-apex)                   | [forcedotcom/salesforcedx-apex](https://github.com/forcedotcom/salesforcedx-apex)           | [@salesforce/apex-node](https://www.npmjs.com/package/@salesforce/apex-node)                           |
| [@salesforce/templates](https://github.com/forcedotcom/salesforcedx-templates)              | [forcedotcom/salesforcedx-templates](https://github.com/forcedotcom/salesforcedx-templates) | [@salesforce/templates](https://www.npmjs.com/package/@salesforce/templates)                           |

Related: `@salesforce/apex` (LWC module resolver; repo not in metadata). `@salesforce/apex-tmlanguage` ([forcedotcom/apex-tmLanguage](https://github.com/forcedotcom/apex-tmLanguage)): **root** `package.json` `devDependencies` only; grammar files are copied from **repo root** `node_modules/@salesforce/apex-tmlanguage/grammars/` in each extension (`../../node_modules/...` from `packages/<name>`). Shared Apex language configuration: **`extension-assets/syntaxes/apex.configuration.json`** (source of truth); `salesforcedx-vscode-apex-log` and `salesforcedx-vscode-apex` copy it into each package’s `syntaxes/` during `copy:grammars`. `salesforcedx-vscode-apex-log` `copy:grammars` also writes `apex.tmLanguage`; SOQL copies `soql.tmLanguage`; Apex copies `apex.tmLanguage` plus that config. In `salesforcedx-vscode-apex`, `compile` depends on `copy:grammars` (`vscode:bundle` does not list `copy:grammars` separately).

## Running Extensions with Local Library Builds

1. **Build the library** — In the library repo, run its build script (usually `yarn build` or `npm run build`).

1. **Copy output to node_modules** — Copy the library's output folder (e.g. `lib` from salesforcedx-templates) into the corresponding `node_modules` folder in this project.
   - Target: `node_modules/@salesforce/<package-name>/` (repo root; npm workspaces hoists deps).
   - Alternative: `npm link` if you're comfortable with it; copy is simpler and avoids symlink quirks.

1. **Bundle** — Run `npm run vscode:bundle`. See [Build](./Build.md) for bundling details.
   - **Wireit cache:** Wireit does not watch `node_modules` for changes. After copying a library, use `WIREIT_CACHE=none` so the bundle runs with your changes instead of a cached result:
     ```bash
     WIREIT_CACHE=none npm run vscode:bundle
     ```

1. **Launch** -
   - Desktop: from the Launch dropdown, click "Launch extensions without compile" (the `vscode:bundle` command does the compilation for you)
   - Web: `npm run run:web`
1. **Repeat** — After any change to the library: build → copy → bundle -> Launch.
1. **Restore (optional)** — When done, run `npm install` to restore the published versions from the lockfile.
