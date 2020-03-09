---
title: Linting 
lang: en
---

Linting provides errors about malformed code while you edit. VS Code enforces Salesforce’s ESLint rules. 

## Prerequisites

[The active LTS release](https://nodejs.org/en/about/releases/) of Node.js built with SSL support. 

## Installation

**For a New Project**
If you've recently created a new SFDX project using the `force:project:create` command, your project contains a `package.json` file with the ESLint plugin already included. Make sure to run `npm install` in your project directory to install the dependencies from `package.json`. To start linting, run `npm run lint:lwc`.

**For an Existing Project**
1. Check whether your project contains a `package.json` file. This file specifies the packages and version required to run your project.
 
If you already have a `package.json` file:
 
- Add `lint` and `lint:lwc` to the scripts section of `package.json`.

```
"scripts": {
"lint": "npm run lint:lwc",
  	"lint:lwc": "eslint force-app/main/default/lwc"
}

- Add the Salesforce ESLint configuration and ESLint to devDependencies. 
	
	"devDependencies" {
		"@salesforce/eslint-config-lwc": "0.4.0",
		"eslint": "^5.16.0"
	}
```
 
- Run `npm install` on your project directory to install the dependencies. Start linting by running `npm run lint:lwc`.

   If you don't have a `package.json` file, copy this file and save it in your project.

2. Check whether you have `.eslintignore` and `.eslintrc.json` files included in your project. 
 
- If you have `.eslintrc.json`, add the following to the file.
```{
    "extends": ["@salesforce/eslint-config-lwc/recommended"]
}
```

- If your project doesn't have either file, copy them to your project from the [project templates](https://github.com/forcedotcom/salesforcedx-templates/tree/master/src/templates/project) Github repository. 

## Configure Linting Rules

ESLint includes three configuration levels. The default level is `@salesforce/eslint-config-lwc/recommended`. To change the configuration level, change `{"extends": ["@salesforce/eslint-config-lwc/recommended"]}` in your `.eslintrc.json` file.

`@salesforce/eslint-config-lwc/base`

This configuration prevents common pitfalls with Lightning Web Components and enforces other Salesforce platform restrictions.

`@salesforce/eslint-config-lwc/recommended`

This configuration prevents common Javascript pitfalls and enforces all best practices.

`@salesforce/eslint-config-lwc/extended`

This configuration restricts the use of some Javascript language features that are sometimes slow in older browsers, such as IE11. To support new Javascript syntax and language features on an older browser, the Lightning Web Components compiler transforms the Lightning Web Components modules. 

For more details on the linting rules and using them individually, see the [ESLint Plugin](https://github.com/salesforce/eslint-plugin-lwc) Github repository. 

## Add Additional Scripts

`package.json` comes with some scripts already pre-configured to run ESLint. You can see them listed in the "scripts" section of `package.json`. To add your own, see the [npm documentation](https://docs.npmjs.com/misc/scripts). 

**See Also**
_ESLint_: [Configuring ESLint](https://eslint.org/docs/user-guide/configuring) 


