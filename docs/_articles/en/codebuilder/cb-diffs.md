---
title: What's Different
lang: en
---
## What’s Different in Code Builder

Code Builder offers the same rich tooling and unleashes the power of Salesforce VS Code extensions  as the desktop version. No matter whether you are using VS Code on desktop or Code Builder from a browser, the Salesforce extensions you access are the same. While the extensions generally function the same way regardless of how they are being accessed, there are some nuances to be aware of:

* Code Builder installed as a managed package, and your Code Builder environment comes pre-configured for you.
* Working in Code Builder doesn’t require you to install VS Code or Salesforce Extensions or Salesforce CLI. 
* Unlike VS Code for the desktop, you cannot add any new extensions to your Code Builder development environment.
* Because Code Builder is inherently lightweight and optimized to run in the cloud, access to certain functionalities is limited:    
    * Functions development is available for Javascript and Typescript Functions only.
    * LWC Local Development (beta) is not available in Code Builder. Deploy LWC components to your org to view them.
* Code Builder allows you to carry your development environment with you. Bookmark your development environment to return to it, or access the link from a different machine. 
* Unlike a desktop IDE, Code Builder saves your work for you without you explicitly having to do so. But since your beta environment's usage is capped at 20 hours, and your environment is wiped once your clock runs out, remember to either push your work to source control or deploy your changes to your org. 

## Known Gaps and Issues
Code Builder is currently in beta,  and we are actively collecting feedback from our customers as we continue to work on improving our project. See [Known Gaps and Issues](https://github.com/forcedotcom/try-code-builder-feedback/wiki/Known-Gaps-and-Issues) for a list of issues we are aware of. 

If you notice any issues that  haven't made our list, or want to provide other types of feedback, such as initial impressions or feature requests, [file an issue](https://github.com/forcedotcom/try-code-builder-feedback/issues) in the GitHub repo. We want to understand what features and enhancements are important to you.

## Important Considerations for Code Builder Beta
We've capped usage for beta at 20 hours for a maximum of 30 days. We highly recommend that you save your work and close the browser tab that is running Code Builder to stop the usage clock when you aren’t using Code Builder.