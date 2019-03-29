---
title: Using Prettier in Salesforce Projects
---

Currently, Prettier supports Aura and LWC as well as standard file formats like `json`, `md`, `html`, and `js` files. Support for Apex is being worked on by the [community](https://github.com/dangmai/prettier-plugin-apex) and should be availible soon.

Using Prettier for Aura and LWC requires some configuration.

> NOTE: Prettier support for LWC is coming in the next release of Prettier (version 1.17.0). However, it can be used now by installing the master branch as shown in this document.

1. If you dont already have a `package.json` in your project run `npm init`. You can accept all the defaults.

1. Install prettier by running `npm i prettier/prettier -D`. This will install the latest master branch of prettier.

1. Create a prettier configuration file in the root of your project called `.prettierrc` with the following content.

   > NOTE: The `trailingComma: "none"` setting is required for Aura.

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

1. You can furthar customize prettier using [other config options](https://prettier.io/docs/en/options.html) as you like.

1. Install the [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) Extension for VS Code.

1. If you want to ensure all your files are formatted you can enable the setting `editor.formatOnSave` in VS Code. You may also want to [setup a git hook](https://prettier.io/docs/en/precommit.html) to format before commiting files to your repository.
