---
title: Linting 
lang: en
---

Linting provides errors about malformed code while you edit. VS Code enforces Salesforce’s ESLint rules.

## Prerequisites

[The active LTS release](https://nodejs.org/en/about/releases/) of Node.js built with SSL support.

## Installation

### For a New Project

If you create an SFDX project using the `sfdx force:project:create` command, your project contains a `package.json` file with the ESLint plugin already included. Run `npm install` in your project directory to install the dependencies from `package.json`. To start linting, run `npm run lint:lwc`. You must have components in your project in order to run this command.

### For an Existing Project with a `package.json` File

1. Add `lint` and `lint:lwc` to the scripts section of `package.json`.

    ```json
    "scripts": {
        "lint": "npm run lint:lwc",
        "lint:lwc": "eslint force-app/main/default/lwc"
    }
    ```

2. In `package.json`, check whether `devDependencies` includes the Salesforce ESLint configuration and ESLint. If not, add these lines.

    ```json
    "devDependencies" {
        "@salesforce/eslint-config-lwc": "0.4.0",
        "eslint": "^5.16.0"
    }
    ```

3. To install the dependencies, run `npm install` on your project directory.
4. To start linting, run `npm run lint:lwc`.

### For an Existing Project without a `package.json` File

1. Copy [this `package.json` file](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/package.json) and save it in your project. Then, run `npm install`.

2. Check whether you have `.eslintignore` and `.eslintrc.json` files included in your project. 
    - If you have `.eslintrc.json`, add the following line to the file.

        ```json
         {
          "extends": ["@salesforce/eslint-config-lwc/recommended"]
         }
        ```

    - Add the Salesforce ESLint configuration and ESLint to `devDependencies`.

    ```json
    "devDependencies" {
        "@salesforce/eslint-config-lwc": "0.4.0",
        "eslint": "^5.16.0"
    }
    ```
    - If your project doesn't have either file, copy the files to your project from the [project templates](https://github.com/forcedotcom/salesforcedx-templates/tree/master/src/templates/project) Github repository.

## Configure Linting Rules

ESLint includes three configuration levels. The default level is `@salesforce/eslint-config-lwc/recommended`.

To change the configuration level, edit this line in the  `.eslintrc.json` file.

```json
{
 "extends": ["@salesforce/eslint-config-lwc/recommended"]
}
```

- `@salesforce/eslint-config-lwc/base`
This configuration prevents common pitfalls with Lightning Web Components and enforces other Salesforce platform restrictions.

- `@salesforce/eslint-config-lwc/recommended`
This configuration prevents common Javascript pitfalls and enforces all best practices.

- `@salesforce/eslint-config-lwc/extended`
This configuration restricts the use of some Javascript language features that are sometimes slow in older browsers, such as IE11. To support new Javascript syntax and language features on an older browser, the Lightning Web Components compiler transforms the Lightning Web Components modules.

For more details on the linting rules and using them individually, see the [ESLint Plugin](https://github.com/salesforce/eslint-plugin-lwc) Github repository.

## Add Additional Scripts

The `"scripts"` section of `package.json` includes some scripts already pre-configured to run ESLint. To add your own, see the [npm documentation](https://docs.npmjs.com/misc/scripts).

## See Also

For more information about configuring ESLint, see the [ESLint User Guide](https://eslint.org/docs/user-guide/configuring).