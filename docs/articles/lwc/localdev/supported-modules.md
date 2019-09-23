# Working With Salesforce Modules

The Local Development server is an SFDX CLI plugin that configures and runs a Lightning Web Components-enabled server on your computer. Now you can develop Lightning Web Component modules and see live changes without publishing your components to an org.

**Note**: This feature is in beta and has been released early so we can collect your feedback. It may contain significant problems, undergo major changes, or be discontinued. If you encounter any problems, or want to request an enhancement, open a [GitHub issue](https://github.com/forcedotcom/lwc-dev-server/issues/new). The use of this feature is governed by the [Salesforce.com Program Agreement](https://trailblazer.me/terms?lan=en).

## Supported Modules

| **Module Name**      | **Local Development Behavior** |
| ----------- | ----------- |
| `@salesforce/resourceUrl`      | Imports static resources into your Salesforce org using the structure: `import <resourceName> from '@salesforce/resourceUrl'`. Static resources are copied and served from the SFDX project location on your filesystem to the local development server.       |
| `@salesforce/label`   | Custom Labels are resolved from the SFDX project directory `labels/CustomLabels.labels-meta.xml`. The local development server displays a placeholder for labels that it either can't find or that you created in Setup but didn't sync to your local filesystem. The placeholder looks like this: `{unknown label: foo}`. In the case where your label is not in your org, SFDX returns an error when you push your code.         |
| `@salesforce/apex`   | Apex requests are proxied to your scratch org.        |
| `@salesforce/schema`   | Follows the same behavior described in the _Lightning Web Components Developer Guide_ [reference](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.reference_salesforce_modules).          |


## Partially Supported Modules

These modules work with the local development server, but behave differently from how they do in a production org. 


| **Module Name**      | **Local Development Behavior** |
| ----------- | ----------- |
| `@salesforce/i18n`      | The locale is set to US/English locale. For local development, all imports from `@salesforce/i18n` are hardcoded to return values that are similar to what you would see in the en-US locale in production.       |
| `@salesforce/user`   | You can include `@salesforce/user` when working in local development. User ID is not supported, and local development assigns it a value of `undefined`. The value of `isGuest` always returns true.         |

## Unsupported Modules

The local development server throws an error if you try to preview any components that use these modules.

`@salesforce/contentAssetUrl`
`@salesforce/apexContinuation`

