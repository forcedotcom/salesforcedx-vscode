---
title: Source Diff
lang: ja
---

The Source Diff command allows you to diff metadata types against your default org. This feature makes it easier to visualize the changes between your local project and the metadata in your org.

> NOTICE: The Source Diff feature is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./ja/bugs-and-feedback).

## Setup

Because the Source Diff feature is in beta, you must install a Salesforce CLI plugin. From the terminal, run `sfdx plugins:install @salesforce/sfdx-diff`.
After the installation is complete, `@salesforce/sfdx-diff` appears in the list of installed plugins when running `sfdx plugins`.

## Usage

Starting in version `46.11.0`, a new menu option `SFDX: Diff File Against Org` appears when you right-click an open metadata file.

![Source Diff command](./images/source_diff.png)

Source Diff currently supports the following metadata:

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
