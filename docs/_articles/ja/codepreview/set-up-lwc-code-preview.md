---
title: Set Up LWC Code Preview
lang: ja
---

To set up LWC Code Preview, install the server, enable and authorize a Dev Hub org, and create a scratch org. To use the LWC Code Preview, you must develop Lightning web components in a Salesforce DX project.

## Install the LWC Code Preview Server

Run this command from a command-line interface.

```
sfdx plugins:install @salesforce/lwc-dev-server
```

> **Troubleshooting Tip:** Due to a known issue, it's likely you'll see several errors when you install the plug-in. Run `sfdx plugins --core` to see if the plug-in is installed. If yes, try to start the Code Preview server. If successful, you're good to proceed.

After you select **SFDX: Preview Component**, the Command Palette displays a list of preview options. You can choose to preview your component in the desktop browser or in a virtual mobile device (iOS or Android). Mobile previews require additional setup. See [Preview Lightning Web Components on Mobile](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.mobile_extensions) in the _Lightning Web Components Dev Guide_.

## Recommended Settings

**Disable Browser Cache**  
To see changes made to your static resources in real time, disable the web browser cache when working with LWC Code Preview.

For some examples of how to disable the web browser cache, see:

- Chrome: https://www.technipages.com/google-chrome-how-to-completely-disable-cache
- Safari: https://www.technipages.com/apple-safari-completely-disable-cache

Another workaround is to make changes to one of the `.js` or `.html` files within your component, which recompiles and caches your new static resources to the browser.
