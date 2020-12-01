---
title: Set Up LWC Code Preview
lang: en
---

To set up LWC Code Preview, install the server, enable and authorize a Dev Hub org, and create a scratch org. To use the LWC Code Preview, you must develop Lightning web components in a Salesforce DX project.

## Install the LWC Code Preview Server

Run this command from a command-line interface.

```
sfdx plugins:install @salesforce/lwc-dev-server
```

After you select **SFDX: Preview Component**, the Command Palette displays a list of preview options. You can choose to preview your component in the desktop browser or in a virtual mobile device (iOS or Android). Mobile previews require additional setup. See [Preview Lightning Web Components on Mobile](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.mobile_extensions) in the _Lightning Web Components Dev Guide_.

## Configuration for Projects (Optional)

To override the default server configuration, add a `localdevserver.config.json` file in the root directory of your DX project.
This example shows the available configuration parameters.

| Key                        | Value                                                                         |
|----------------------------| ------------------------------------------------------------------------------|
| main                       | Name of the component to load in the default container.                       |
| modulesSourceDirectory     | Location of component files.                                                  |
| staticResourcesDirectories | Static resources location.                                                    |
| port                       | The address port for your local development server. The default port is 3333. |
| customLabelsFile           | Path to the custom labels file.

```
{
    "main": "app",
    "modulesSourceDirectory": "src/",
    "staticResourcesDirectories": [
        "staticresources"
    ],
    "port": 3333,
    "customLabelsFile": "labels/CustomLabels.labels-meta.xml"
}
```

