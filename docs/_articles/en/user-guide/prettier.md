---
title: Prettier Code Formatter
lang: en
---

Prettier code formatter supports standard file formats such as JSON, Markdown, HTML, and JavaScript. Prettier can also support Apex, Aura, and Lightning Web Components (LWC) if you install [Prettier Apex plugin](https://github.com/dangmai/prettier-plugin-apex) contributed by [Dang Mai](https://github.com/dangmai).

## Prerequisites

This plugin requires NodeJS and npm in your environment. Refer to [`Downloading and installing Node.js and npm`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) for details on their setup.

## Installation

To install the Prettier Apex plugin:

1. Navigate to the top-level of your project

1. Check if your project contains the `package.json` file. If not, run: `npm init` and accept all the default options.

1. Run: `npm install --save-dev --save-exact prettier prettier-plugin-apex`.

Before you install the Prettier code formatter, create a configuration file `.prettierrc` in the root of your project. If you’d like to know more about customizable format options of Prettier, read [other config options](https://prettier.io/docs/en/options.html).

```json
{
  "trailingComma": "none",
  "overrides": [
    {
      "files": "**/lwc/**/*.html",
      "options": { "parser": "lwc" }
    },
    {
      "files": "*.{cmp,page,component}",
      "options": { "parser": "html" }
    }
  ]
}
```

> NOTE: The `"trailingComma": "none"` setting is required for Aura.

After creating the local configuration file, install the [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extension for VS Code. If you want to ensure that all your files are formatted whenever you save them, enable the `editor.formatOnSave` setting in [User and Workspace Settings](https://code.visualstudio.com/docs/getstarted/settings). You can use Prettier with a pre-commit tool to reformat your files before you commit the files. For more information, see [set up a Git hook](https://prettier.io/docs/en/precommit.html).

Prettier Apex plugin runs slower than most other formatters. Because saving is a critical operation, you can decide if you want to wait till the plugin completes formatting before saving the file. Read how VS code [handles slow save operations](https://code.visualstudio.com/updates/v1_42#_handling-slow-save-operations).
