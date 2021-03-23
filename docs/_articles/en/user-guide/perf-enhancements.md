---
title: Performance Enhancements
lang: en
---

The Apex, Deploy and Retrieve commands are in the process of moving to a new architecture. These commands have been rearchitected into independent Typescript libraries and CLI plugins as part of our larger effort to break up the salesforce-alm plugin.  [You can read more about that in this blog post](https://developer.salesforce.com/blogs/2021/02/open-sourcing-salesforce-cli-update-feb-2021.html). There’s many great benefits to this effort and one of the best is better performance. For single file deploys and retrieves, you'll likely notice a significant performance gain when using the latest architecture.

## Execution Process and Status

This architecture change is done through a phased approach.  For both the Apex library and Deploy/Retrieve library, we are rolling out the changes through these phases:

1. Library created and completed.
2. Available to try it in VS Code - We provide a VS Code setting so you can opt in and try it out. 
3. On by default in VS Code - The VS code setting default is defaulted to True to enable the library. If you previously opted in and then opted out, you'll have to manually opt back in to use the feature.  We'll change the default after the commands have been available and used for months.
4. CLI updated to use the library.  The VS Code setting is then retired.  Both the CLI and VS Code extensions are using the library.





|                         | Library complete	| Available to try in VS Code	| On by default in VS Code	| CLI Updated  |
|-------------------------|:-----------------:|:---------------------------:|:-------------------------:|:------------:|
| Apex Library	          |        ✔️          |               ✔️             |             ✔️             |              |
| Deploy Retrieve Library |        ✔️          |               ✔️             |                           |              |
	

## Setup

There is a VS Code setting for each library.  Access them by selecting Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).

Within settings, you will see the following:

1. *Experimental: Deploy Retrieve*.
2. *Experimental: Use Apex Library*

Known gaps:
- If you're using [CLI Plug-In Hooks](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/cli_plugins_customize_hooks.htm), those are not available when using the library from VS Code.  Uncheck the settings above to use the CLI directly for those commands.

If you spot other gaps or have feedback, please [open a GitHub issue](https://github.com/forcedotcom/salesforcedx-vscode/issues/new/choose).
