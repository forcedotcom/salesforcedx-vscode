---
title: What's Different
lang: en
---

## What’s Different in Code Builder

Code Builder unleashes the power of Salesforce Extensions for VS Code and offers the same rich features as the desktop version. No matter whether you're using VS Code on your desktop or Code Builder from a browser, the Salesforce extensions you access are the same. While the extensions generally function the same way regardless of how they're accessed, there are some nuances to be aware of:

- Code Builder is installed as a managed package, and it comes with everything you need: VS Code, Salesforce Extensions, and Salesforce CLI. No installation required.
- Unlike VS Code for the desktop, you can't add any new extensions to your Code Builder development environment.
- Because Code Builder is inherently lightweight and optimized to run in the cloud, access to certain functionalities is limited:
  - LWC Local Development (beta) is not available in Code Builder. You can't preview LWC components locally, but can deploy them to your org to view them.
- Because your Code Builder instance runs in the cloud, authorizing an org from it follows a different (device) flow than the desktop IDE. See [Connect to Different Org](https://developer.salesforce.com/tools/vscode/en/codebuilder/cb-start/#connect-to-a-different-org) for steps.

## Known Gaps and Issues

See [Known Gaps and Issues](https://github.com/forcedotcom/try-code-builder-feedback/wiki/Known-Gaps-and-Issues) for a list of issues we're aware of.

If you notice any issues that haven't made our list, or want to provide other types of feedback, such as initial impressions or feature requests, [file an issue](https://github.com/forcedotcom/try-code-builder-feedback/issues) in the GitHub repo. We want to understand what features and enhancements are important to you.
