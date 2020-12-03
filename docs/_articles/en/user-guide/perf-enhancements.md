---
title: Performance Enhancements
lang: en
---

The changes we have made to enhance performance ensure that single file metadata deploys run through a more efficient code path. Currently, these changes only support a limited number of metadata types. We’ll add support for more metadata types in future releases.

> NOTICE: The changes to enhance code performance are currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback).

## Setup

To enable this beta feature:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
1. Under Salesforce Feature Previews, select Experimental: Deploy Retrieve.

In this beta release, performance enhancements are effective when you run the following commands:

- SFDX: Deploy This Source to Org
- SFDX: Retrieve This Source from Org
- SFDX: Retrieve Source in Manifest from Org
- Retrieve Using the [Org Browser](./en/user-guide/org-browser)
