---
title: Set Up the Prettier Code Formatter for Salesforce Projects
---

Currently, Prettier supports Aura and Lightning Web Components (LWC) as well as standard file formats like `.json`, `.md`, `.html`, and `.js`. Support for Apex is being worked on by the [community](https://github.com/dangmai/prettier-plugin-apex) and should be available soon.

Using Prettier for Aura and LWC requires some configuration.

> NOTE: Prettier support for LWC is coming in the next release of Prettier (version 1.17.0). However, it can be used now by installing the `master` branch as shown in this document.

1. If you don’t already have a `package.json` in your project, run: `npm init`  
  You can accept all the defaults.

1. Install the latest `master` branch of Prettier by running: `npm i prettier/prettier -D`

1. Create a Prettier configuration file called `.prettierrc`, in the root of your project, with the following content.

   > NOTE: The `"trailingComma": "none"` setting is required for Aura.

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

1. If you’d like to further customize Prettier, add [other config options](https://prettier.io/docs/en/options.html).

1. Install the [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extension for VS Code.

1. If you want to ensure that all your files are formatted, enable the setting `editor.formatOnSave` in VS Code. For information about configuring your settings, see [User and Workspace Settings](https://code.visualstudio.com/docs/getstarted/settings) in the Visual Studio Code docs.

If you want to format your files each time that you commit changes to your Git repository, [set up a Git hook](https://prettier.io/docs/en/precommit.html).
