---
title: Linting 
lang: en
---

Linting provides errors about malformed code while you edit. VS Code enforces Salesforce’s ESLint rules.

## Prerequisites

[The active LTS release](https://nodejs.org/en/about/releases/) of Node.js built with SSL support.

## Installation

### For a New Project

If you create an SFDX project using the `sfdx force:project:create` command, your project contains a `package.json` file with the ESLint plugin already included.

1. To install the ESLint plugin and other dependencies, run `npm install` in your project directory.

2. Copy the [.eslintrc.json](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/.eslintrc.json) file and save it to your project directory. Configure the ESLint plugin rules as needed.

3. To run linting, you must have components in your project. To start linting, run `npm run lint:lwc`.

### For an Existing Project

1. Verify that your project has a `package.json` with these configurations. If it doesn't, run `npm install @salesforce/eslint-config-lwc eslint@5 -D`.

    ```json
    "scripts": {
        "lint": "npm run lint:lwc",
        "lint:lwc": "eslint force-app/main/default/lwc"
    }

    "devDependencies" {
        "@salesforce/eslint-config-lwc": "0.4.0",
        "eslint": "^5.16.0"
    }
    ```

2. If it doesn't have the [`package.json`](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/package.json) file, copy it and add it to your project directory.

3. Verify that your project has this [`.eslintignore`](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/.eslintignore) file. If it doesn't, add it to your project directory.

4. Verify that your project has this [`.eslintrc.json`](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/.eslintrc.json) file. If it doesn't, add it to your project directory.

5. To install the ESLint plugin and other dependencies, run `npm install` on your project directory.

6. To run linting, you must have components in your project. To start linting, run `npm run lint:lwc`.

## Configure Linting Rules

ESLint includes three configuration levels. The default level is `@salesforce/eslint-config-lwc/recommended`.

To change the configuration level, edit this line in the  `.eslintrc.json`

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

- For more information about configuring ESLint, see the [ESLint User Guide](https://eslint.org/docs/user-guide/configuring).
- [github.com/salesforce/eslint-plugin-lwc](https://github.com/salesforce/eslint-plugin-lwc)
- [github.com/salesforce/eslint-config-lwc](https://github.com/salesforce/eslint-config-lwc)
