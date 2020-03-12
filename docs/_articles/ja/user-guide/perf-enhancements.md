---
title: Performance enhancements
lang: ja
---

The performance enhancement changes allows you to run single file metadata deploys through a more efficient code path. These changes currently only support Apex Class metadata types. More metadata types will get included in the following releases.

> NOTICE: Performance enhancement changes for single Apex Class file deploys is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback).

## Setup

Because the performance enhancement changes are in beta, you must enable them:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
1. Under Salesforce Feature Previews, select Experimental: Deploy Retrieve.

In this beta release, we have released performance enhancement changes when running the **SFDX: Deploy this Source to Org** command only when running it for Apex Class.
