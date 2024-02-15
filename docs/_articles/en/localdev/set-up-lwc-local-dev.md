---
title: Set Up LWC Local Development
lang: en
---

To set up LWC Local Development, install the server, enable and authorize a Dev Hub org, and create a scratch org. To use the LWC Local Development, you must develop Lightning web components in a Salesforce DX project.

## Install the LWC Local Development Server

Run this command from a command-line interface.

```
sf plugins install @salesforce/lwc-dev-server
```

> **Troubleshooting Tip:** Due to a known issue, it's likely you'll see several errors when you install the plug-in. Run `sf plugins --core` to see if the plug-in is installed. If yes, try to start the Local Development server. If successful, you're good to proceed.

After you select **SFDX: Preview Component Locally**, the Command Palette displays a list of preview options. You can choose to preview your component in the desktop browser or in a virtual mobile device (iOS or Android). Mobile previews require additional setup. See [Preview Lightning Web Components on Mobile](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.mobile_extensions) in the _Lightning Web Components Dev Guide_.
