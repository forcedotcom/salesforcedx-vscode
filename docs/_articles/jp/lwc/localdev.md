---
title: Local Development (Beta)
lang: jp
---

The Local Development Server is a Salesforce CLI plugin that configures and runs a Lightning Web Components-enabled server on your computer. Now you can develop Lightning Web Component modules and see live changes without publishing your components to an org.

**Note**: This feature is in beta and has been released early so we can collect your feedback. It may contain significant problems, undergo major changes, or be discontinued. If you encounter any problems, or want to request an enhancement, open a [GitHub issue](https://github.com/forcedotcom/lwc-dev-server-feedback/issues). The use of this feature is governed by the [Salesforce.com Program Agreement](https://trailblazer.me/terms?lan=en).

- [Setup](#setup)
  - [System Requirements](#system-requirements)
  - [Installation](#installation)
  - [Troubleshooting](#troubleshooting)
  - [Configuration for Projects (Optional)](#configuration-for-projects)
- [Working With Modules and Components](#working-with-modules-and-components)
  - [Supported Modules](#supported-modules)
  - [Partially Supported Modules](#partially-supported-modules)
  - [Unsupported Modules](#unsupported-modules)
  - [Unsupported Components](#unsupported-components)
- [Considerations](#considerations)
- [Common Errors](#common-errors)
  - [Using an Unsupported Dependency](#using-an-unsupported-dependency)
  - [Using a Nonexistent Component](#using-a-nonexistent-component)
  - [Using a Component in a Nonexistent Namespace](#using-a-component-in-a-nonexistent-namespace)

## **Setup**

## System Requirements

- Developer Hub-enabled org
- Most recent stable version of Chrome, Firefox, Safari, or Edge web browser
- Windows—Windows 7 (64-bit and 32-bit) or later
- Mac—macOS 10.11 or later
- Linux—Ubuntu 14.0.4 or later
- Salesforce CLI

To develop Lightning web components, use your favorite code editor. We recommend using Visual Studio Code because its [Salesforce Extensions for VS Code](https://developer.salesforce.com/tools/extension_vscode) provide powerful features for development on Lightning Platform.

## Installation

1. Open a new terminal window and run the following command to install the local development server.

   ```sh
   sfdx plugins:install @salesforce/lwc-dev-server
   ```

2. Check for updates to the local development server.

   ```sh
   sfdx plugins:update
   ```

3. Navigate to your SFDX project, or clone one that has Lightning web components. In this example, we are using `lwc-recipes`.

   ```sh
   git clone git@github.com:trailheadapps/lwc-recipes.git
   ```

4. If you're not in the the `lwc-recipes` root directory already, `cd` into it.

   ```sh
   cd lwc-recipes
   ```

5. Add the `.localdevserver` folder in your SFDX project to your `.gitignore` file. Do not modify files inside of this folder.

6. Authorize a Developer Hub (Dev Hub) by following the steps in [Enable Dev Hub In Your Org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_enable_devhub.htm) in the _Salesforce DX Developer Guide_. A Dev Hub is the main Salesforce org that you and your team use to create and manage your scratch orgs, temporary environments for developing on the Salesforce platform. You need the Dev Hub to create a scratch org in a later step.

7. Following the instructions in the _Salesforce DX Developer Guide_, log in using your Dev Hub credentials. Running the following command opens a login window in your browser.

   ```sh
   sfdx force:auth:web:login -d -a <myhuborg>
   ```

8. In local development, requests to Lightning Data Service and Apex go to scratch orgs, similar to how they go to your production org. To create a scratch org, run this command from the command line. Here, “LWC” is an alias for the scratch org that you can use in other Salesforce CLI commands.

   ```sh
   sfdx force:org:create -s -f config/project-scratch-def.json -a "LWC"
   ```

   The scratch org definition defines the org edition, features, org preferences, and other options. This example uses the scratch org definition file, `project-scratch-def.json` that is included in `lwc-recipes`. For other projects, create your own. For more information, see the instructions for [Create Scratch Orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_create.htm) in the _Salesforce DX Developer Guide_.

9) Push your code to your scratch org.

   ```sh
   sfdx force:source:push
   ```

10) Start the server.

    ```sh
    sfdx force:lightning:lwc:start
    ```

11) View the server at [http://localhost:3333/](http://localhost:3333/).

For more information on local development commands, view the local development documentation by running sfdx force:lightning:lwc:<commandName> --help.

## Troubleshooting

```sh-session
$ sfdx force:lightning:lwc:start
Starting LWC Local Development.
    Dev Hub Org: mydevhub
    Scratch Org: undefined - We can't find an active scratch org for this Dev Hub. Create one by following the steps in Create Scratch Orgs in the Salesforce DX Developer Guide (https://sfdc.co/cuuVX4) or the Local Development Server Getting Started.
```

If you see this error, make sure that you authenticate to your Dev Hub and create a scratch org.

## Configuration for Projects (Optional)

SFDX automatically configures your project out of the box, but if you need to override configuration for the server, add a localdevserver.config.json file at the base of your project.

Here's an example that shows the available configuration parameters.

```json5
{
  // What namespace to use referencing your Lightning Web Components
  namespace: 'c',

  // Name of the component to load in the default container
  main: 'app',

  // Where are your component files. If you have a namespace, specify the directory the namespace folder is in.
  modulesSourceDirectory: 'src/',

  // Where are your static assets.
  staticResourcesDirectory: 'staticresources',

  // The address port for your local server. Defaults to 3333
  port: 3333,

  // Optional path to the custom labels file
  customLabelsFile: 'labels/CustomLabels.labels-meta.xml'
}
```

## **Working With Modules and Components**

## Supported Modules

The local development server supports the following modules. Modules refer to `@salesforce` modules and modules imported without `@salesforce`, like `lightning/empApi`. For more information about how these modules work with Lightning web components, see [`@salesforce` Modules](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.reference_salesforce_modules) in the _Lightning Web Components Developer Guide_.

| **Module Name** | | **Local Development Behavior** |
| ----------- | | ----------- |
| `@salesforce/resourceUrl` | | Imports static resources into your Salesforce org using the structure: `import <resourceName> from '@salesforce/resourceUrl'`. Static resources are copied and served from the SFDX project location on your filesystem to the local development server. |
| | | |
| `@salesforce/label` | | Custom Labels are resolved from the SFDX project directory `labels/CustomLabels.labels-meta.xml`. The local development server displays a placeholder for labels that it either can't find or that you created in Setup but didn't sync to your local filesystem. The placeholder looks like this: `{unknown label: foo}`. In the case where your label is not in your org, SFDX returns an error when you push your code. |
| | | |
| `@salesforce/apex` | | Apex requests are proxied to your scratch org. |
| | | |
| `@salesforce/schema` | | Follows the same behavior described in the _Lightning Web Components Developer Guide_ [reference](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.reference_salesforce_modules). |

## Partially Supported Modules

These modules work with the local development server, but behave differently from how they do in a production org.

| **Module Name** | | | **Local Development Behavior** |
| ---------------- | | |------------------------------ |
| `@salesforce/i18n` | | | The locale is set to US/English locale. For local development, all imports from `@salesforce/i18n` are hardcoded to return values that are similar to what you would see in the en-US locale in production. |
| | | | |
| `@salesforce/user` | | | You can include `@salesforce/user` when working in local development. User ID is not supported, and local development assigns it a value of `undefined`. The value of `isGuest` always returns true. |

## Unsupported Modules

The local development server throws an error if you try to preview any components that use these modules.

- `@salesforce/contentAssetUrl`
- `@salesforce/apexContinuation`
- `lightning/empApi`
- `lightning/platformShowToastEvent`

## Unsupported Components

The local development server throws an error if you try to use the following components.

- `lightning-file-upload`
- `lightning-formatted-address`
- `lightning-map`

## **Considerations**

- The local development server supports Lightning web components only. It does not support Aura components.
- Don't connect to a production Salesforce org with the local development server. Local development uses data in real time. If you authenticate to a production org, then you will modify or overwrite data in production.
- You can't specify or change attribute values for your components on the component preview page. Components render with their default attribute values. For example, let's say you're writing a clock component. To view the component, the clock needs to know your timezone, which requires setting a timezone attribute. We recommend setting a default timezone in the code. If you can't specify a default value, create a wrapper component that creates the clock and sets the proper attributes. To prevent confusion, make sure to give your wrapper component a name that clarifies it is for testing purposes only.
- SLDS CSS and icons are included with the local development plugin, and are automatically included on every page. If you notice differences between how some SLDS classes render in local development versus how they do on your Salesforce instance, they may be running different versions. In the beta release, you cannot modify the version of SLDS, and it won't sync with the version you're running on your instance.
- In local development, component UI is rendered locally on your machine. However, data manipulation code like calls to the uiRecordApi wire adapters and Apex controllers get sent to your authenticated Salesforce org. This means that creating, editing, and deleting records or data are reflected in the org, in addition to what is displayed on your local machine. Don't authenticate the Salesforce CLI to a production Salesforce org.
- Flexipages aren't supported.
- Locker is not supported.
- Salesforce Standard Design Tokens and Custom Tokens in CSS files aren't supported. For more information about Design Tokens and Custom Tokens, see the [Salesforce Lightning Design System](https://www.lightningdesignsystem.com/design-tokens/).

## **Common Errors**

Here are common errors that you may run into while working with the local development server.

## Using an Unsupported Dependency

This error occurs when you use an unsupported Salesforce module. In this example, a user tries to import an unsupported dependency called userPermission: `import userPermission from '@salesforce/userPermission';`

![Screenshot of unsupported dependency error](./images/localdev_error_dependency.png)

```
talon.js:3554 Uncaught Error: Unknown scope, cannot resolve dependency 'userPermission'
at assert$1 (talon.js:3554)
at Resolver.resolve (talon.js:10541)
at resolve (talon.js:11642)
at Resolver.resolve (talon.js:10542)
at ModuleRegistry.evaluateModuleDependency (talon.js:11818)
at talon.js:11770
at Array.map (<anonymous>)
at ModuleRegistry.resolveExports (talon.js:11765)
at ModuleRegistry.addModule (talon.js:11750)
at ModuleRegistry.define (talon.js:11719)
```

For more information about which modules the local development server supports, see [Supported Salesforce Modules](#supported-modules).

## Using a Nonexistent Component

This error message occurs when you try to use a component that isn't included in your local project or used globally. Here, the local development server cannot find the component `c-clockzzz`.

![Screenshot of unsupported dependency error](./images/localdev_error_component.png)

```
Uncaught Error: Could not resolve entry (c/clockzzz)
at error (:3333/Users/<path-to-workspace>/Dev/lwc-dev-server/node_modules/rollup/dist/rollup.js:3460)
at :3333/<path-to-workspace>/lwc-dev-server/node_modules/rollup/dist/rollup.js:21359
```

## Using a Component in a Nonexistent Namespace

If you use a namespace that either wasn't created in your org or that isn't part of the Component library, the local development server will produce this error.

![Screenshot of unsupported dependency error](./images/localdev_error_namespace.png)

```
talon.js:11847 Uncaught Error: Cannot resolve module 'force'
at ModuleRegistry.evaluateUnscopedModuleDependency (talon.js:11847)
at ModuleRegistry.evaluateModuleDependency (talon.js:11822)
at talon.js:11770
at Array.map (<anonymous>)
at ModuleRegistry.resolveExports (talon.js:11765)
at ModuleRegistry.addModule (talon.js:11750)
at ModuleRegistry.define (talon.js:11719)
at clock.js:1
```
