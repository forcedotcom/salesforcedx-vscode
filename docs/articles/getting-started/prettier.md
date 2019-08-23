---
title: Set Up the Prettier Code Formatter for Salesforce Projects
---

Currently, Prettier supports Apex, Aura, and Lightning Web Components (LWC) as well as standard file formats like `.json`, `.md`, `.html`, and `.js`.

Using Prettier for Apex, Aura, and LWC requires some configuration.

1. If you don’t already have a `package.json` in your project, run: `npm init`  
   You can accept all the defaults.

1. Install Prettier by running: `npm install --save-dev --save-exact prettier prettier-plugin-apex`

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
