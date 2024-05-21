---
title: Troubleshooting
lang: en
---

Generative AI uses large language models (LLMs) to generate the output. Because LLMs are trained by other organizations, the output isn’t always what you expect, and the code that’s generated isn’t perfect. If the output doesn’t meet your expectations, you can generate a new output by starting over. The generated output from the previous attempt isn’t saved, and the new output replaces it.

To track all known issues and potential workarounds, use the [Issues](https://github.com/forcedotcom/Einstein-GPT-for-Developers/issues) tab in this repo.

**Note:** If your company requires the use of a proxy, we recommend setting this through the Salesforce CLI, not through VS Code, in order to use the Einstein for Developers extension.

## Troubleshooting Checklist
Use this troubleshooting checklist to identify and eliminate common problems with using Einstein for Developers.

### Installation Checklist

1. Check that you are on VS Code version 1.82.0 or higher. 
2. Confirm that you have the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) or the [Salesforce Expanded Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-expanded) installed.
3. Check that your Apex Extension is version 59.8.0 or higher.
4. Hover over {} in the status bar to view the status of the Apex Language Server and make sure it’s running.  
5. Einstein for Developers needs Salesforce CLI version 59.13.0 or higher. See the [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli_rc.htm).

### Development Environment Checklist

1. Einstein for Developers only runs inside a Salesforce project. Confirm that you have a Salesforce DX project open by checking that you have an `sfdx-project.json` file stored in your workspace. For more information see [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm).
2. Check that your Einstein for Developers extension is activated using the **Developer: Show Running Extensions** command. If your extension isn’t activating, file an [issue](https://github.com/forcedotcom/Einstein-GPT-for-Developers/issues) in our GitHub repo.
3. Make sure you’re connected to a Salesforce org. The status of your default org connection is visible in the status bar.

![Default Org](./images/default-org.png)

**Tip**: Run the **SFDX: Open Default Org** command to easily check that your Salesforce extensions are running correctly and that you're connected to a Salesforce org.

### Code Builder Environment Checklist

Einstein for Developers is disabled by default in new Code Builder environments. Telemetry is used to audit enablement of Salesforce Generative AI functionality and must be on during enablement. To enable this extension in a new environment:

1. Go to **Settings** > **Application** > **Telemetry** and set the dropdown value to `all`.
2. Click the Einstein icon in the status bar and enable the extension. 
 
 Telemetry can be disabled once the extension is enabled.
