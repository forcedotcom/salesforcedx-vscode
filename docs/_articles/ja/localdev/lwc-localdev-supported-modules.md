---
title: Supported and Unsupported Modules, Components, and Features
lang: ja
---

You can use most components, `@salesforce` modules, and framework features in Local Development. There are a few differences to be aware of, which are detailed below. If you don’t see a module or component listed, you can expect it to work the same as in your org.

## Supported Modules

We support these modules.

**@salesforce/apex**
: Exposes Apex methods. Use this module to invoke Apex methods. Apex requests are proxied to your scratch org.

**@salesforce/label**
: Exposes labels in your Salesforce org. The local development server resolves labels from the SFDX project file `force-app/main/default/labels/CustomLabels.labels-meta.xml`. The Local Development server displays a placeholder for labels that it can't find or that you didn't sync to your local filesystem. The placeholder follows this format: `{unknown label:labelName}`.

**@salesforce/resourceUrl**
: Exposes static resources in your Salesforce org. Static resources are copied and served from the DX project location on your filesystem, `force-app/main/default/staticresources`, to the server.

**@salesforce/schema**
: Exposes Salesforce schema metadata. Use this module to import references to Salesforce objects and fields. This module behaves the same as it does in a production org.

## Partially Supported Modules

These modules work with the Local Development server, but behave differently than they do in a production org.

**@salesforce/i18n**
: The locale is set to en-US. All imports from `@salesforce/i18n` are hardcoded to return values that are similar to what you would see in the en-US locale in a production org.

**@salesforce/user**
: The value of `@salesforce/user/Id` is always undefined. The value of `@salesforce/user/isGuest` is always `true`.

**lightning/empApi**
: Module appears in the preview, but it's not possible to interact with it.

**lightning/platformShowToastEvent**
: Nothing happens when you do an action that would usually result in a toast notification.

## Unsupported Modules

This behavior occurs if you try to preview any components that use these unsupported modules.

**@salesforce/apexContinuation**
: An error message on the Local Development page.

**@salesforce/navigation**
: Module appears in the preview, but it's not possible to interact with it.

**lightning/messageService**
: An error message on the Local Development page.

## Unsupported Components

The server throws an error or you can't interact with it.

**lightning-file-upload**
: Component appears in the preview, but it's not possible to interact with it.

## Unsupported Features

- Lightning Pages
- Lightning Locker
- Salesforce Standard Design Tokens and Custom Tokens in CSS files

## Components Use Default Attribute Values

The server renders components using their default attribute values. You can’t specify or change an attribute value. For example, let's say you're writing a clock component. To view the component, the clock must know your time zone, which requires setting a timezone attribute. We recommend setting a default timezone in the code. If you can't specify a default value, create a wrapper component that creates the clock and sets the proper attributes. To prevent confusion, make sure to give your wrapper component a name that clarifies that it’s for testing purposes only.

## SLDS Version

SLDS CSS and icons are included with the Local Development plug-in, and are automatically included on every page. If you notice that some SLDS classes render differently in preview than they do on your Salesforce org, they are likely running different versions. The version of SLDS in the plug-in doesn’t sync with the version in your org.
