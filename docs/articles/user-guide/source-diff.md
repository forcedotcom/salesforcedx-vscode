---
title: Source Diff
---

The Source Diff command allows you to diff metadata types against your default org. This feature makes it easier to visualize the changes between your local project and the metadata in your org.

> NOTICE: The Source Diff feature is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](../bugs-and-feedback).

## Setup

Because the Source Diff feature is in beta, you must first install a Salesforce CLI plugin:

1. In your terminal, run `sfdx plugins:install @salesforce/sfdx-diff`
1. Once the install is complete you should see `@salesforce/sfdx-diff` as part of your installed plugins when running `sfdx plugins`

## Usage

Starting in version `46.11.0` you'll now get a new menu option `SFDX: Diff File Against Org` when right-clicking on an open metadata file.

![Source Diff command](../../images/source_diff.png)

Because source diff is in beta, there is a limited set of metadata supported. The list of supported metadata is the following:

- Apex Class
- Apex Trigger
- Aura Application
- Aura Component
- Aura Event
- Aura Interface
- Aura Token
- Lightning Web Component
- Visualforce Page
- Visualforce Component
