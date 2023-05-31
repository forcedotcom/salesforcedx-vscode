---
title: What's Different
lang: en
---
## What’s Different in Code Builder

Code Builder unleashes the power of Salesforce Extensions for VS Code and offers the same rich features as the desktop version. No matter whether you're using VS Code on your desktop or Code Builder from a browser, the Salesforce extensions you access are the same. While the extensions generally function the same way regardless of how they're accessed, there are some nuances to be aware of:

* Code Builder is installed as a managed package, and it comes with everything you need: VS Code, Salesforce extensions, and Salesforce CLI. No installation required. 
* Unlike VS Code for the desktop, you can't add any new extensions to your Code Builder development environment.
* Because Code Builder is inherently lightweight and optimized to run in the cloud, access to certain functionalities is limited:    
    * Functions development is available only for Javascript and Typescript functions.
    * LWC Local Development (beta) is not available in Code Builder. You can't preview LWC components locally, but deploy them to your org to view them.
* With Code Builder, you can work from anywhere. Bookmark your development environment to return to it, or access the link from a different machine. 
* Unlike a desktop IDE, Code Builder saves your work for you without you explicitly having to do so. However, your beta environment's usage is capped at 20 hours. Once the clock runs out, your data and metadata are deleted. Be sure to push your work to your source control system or deploy your changes to your org. 
* Because your Code Builder instance runs in the cloud, authorizing an org from it follows a different (device) flow than the desktop IDE. See [Connect to Different Org](https://developer.salesforce.com/tools/vscode/en/codebuilder/cb-start/#connect-to-a-different-org) for steps.

## Known Gaps and Issues
Code Builder is currently in beta, and we are actively collecting feedback from our customers as we continue to work on improving our project. See [Known Gaps and Issues](https://github.com/forcedotcom/try-code-builder-feedback/wiki/Known-Gaps-and-Issues) for a list of issues we are aware of. 

If you notice any issues that haven't made our list, or want to provide other types of feedback, such as initial impressions or feature requests, [file an issue](https://github.com/forcedotcom/try-code-builder-feedback/issues) in the GitHub repo. We want to understand what features and enhancements are important to you.

## Important Considerations for Code Builder Beta
We've capped usage for beta at 20 hours for a maximum of 30 days. We highly recommend that you save your work and close the browser tab to stop the usage clock when you aren’t using Code Builder.
