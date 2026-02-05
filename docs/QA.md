# Running Web Extensions locally

Vscode doesn't offer a way to prepulate locally running web extensions settings. If you just run them, you'll have to supply auth credentials and any configurations you want to set. That's painful for `--watch` as you edit the extension.

Use the `run:web` command from an extension that supports it.

## Environment Variables and Configuration

The web build supports injecting VS Code settings and org credentials at build time using environment variables and a configuration file.

### Environment Variables

#### `ESBUILD_WEB_LOCAL`

Enables local development mode. When set, the build will read additional settings from `.esbuild-web-extra-settings.json` at the repo root.
This file is gitignored.

```bash
ESBUILD_WEB_LOCAL=1 npm run run:web -w packages/salesforcedx-vscode-metadata
```

#### `ESBUILD_WEB_ORG_ALIAS`

Specifies a Salesforce org alias to fetch credentials from. The build will run `sf org display -o <alias> --json` and inject the org's `instanceUrl`, `accessToken`, and `apiVersion` into VS Code settings.

```bash
ESBUILD_WEB_ORG_ALIAS=myOrg npm run run:web -w packages/salesforcedx-vscode-metadata
```

### Configuration File: `.esbuild-web-extra-settings.json`

Create this file at the repo root (it's gitignored) to add additional VS Code settings that will be merged with org credentials (if provided).

**Example:**

```json
{
  "workbench.colorTheme": "Monokai",
  "editor.fontSize": 14
}
```

Settings from this file are merged with org credentials (if `ESBUILD_WEB_ORG_ALIAS` is set). The org credentials take precedence if there are conflicts.

### Complete Example

```bash
export ESBUILD_WEB_ORG_ALIAS=myScratchOrg
npm run run:web -w packages/salesforcedx-vscode-metadata
```

**it DOES NOT work if you put the env before the command--wireit envs are not transitive between commands, but they will all read from the same environment if you export it **

This will:

1. Fetch org credentials from `myScratchOrg` alias
2. Read additional settings from `.esbuild-web-extra-settings.json`
3. Inject all settings into the bundle via esbuild `define`
4. Apply settings at runtime when the extension activates

### Troubleshooting

**Settings not appearing?**

- Clear wireit cache: `rm -rf packages/salesforcedx-vscode-services/.wireit packages/salesforcedx-vscode-services/dist`
- Verify `.esbuild-web-extra-settings.json` exists at repo root
- Check that org alias exists: `sf org list`

**Auth values missing?**

- Verify `ESBUILD_WEB_ORG_ALIAS` is set correctly
- Ensure the org alias exists and is authenticated: `sf org display -o <alias>`
- Clear wireit cache and rebuild (env vars don't invalidate cache automatically)
