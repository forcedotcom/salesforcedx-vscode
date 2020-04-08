---
title: Performance Enhancements
lang: ja
---

The performance enhancement changes allow you to run single file metadata deploys through a more efficient code path. These changes currently only support Apex Class metadata types. Additional metadata types will be supported in future releases.

> NOTICE: Performance enhancement changes for single Apex Class file deploys is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback).

## Setup

To enable this beta feature:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
1. Under Salesforce Feature Previews, select Experimental: Deploy Retrieve.

In this beta release, performance enhancements will only occur when running the **SFDX: Deploy this Source to Org** command with the following metadata types:

- Apex Class
- Apex Trigger
- Visualforce Component
- Visualforce Page
