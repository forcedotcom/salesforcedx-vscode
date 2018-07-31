# Apex Replay Debugger for Visual Studio Code (Beta)
Apex Replay Debugger simulates a live debugging session using a debug log that is a recording of all interactions in a transaction. You no longer need to parse through thousands of log lines manually. Instead, Apex Replay Debugger presents the logged information similarly to an interactive debugger, so you can debug your Apex code. The debugging process is a repetition of editing your Apex code, pushing or deploying the code to your org, reproducing the buggy scenario, downloading the resulting debug log, and launching Apex Replay Debugger with that debug log.

---
NOTE: As a beta feature, Apex Replay Debugger is a preview and isn’t part of the “Services” under your master subscription agreement with Salesforce. Use this feature at your sole discretion, and make your purchase decisions only on the basis of generally available products and features. Salesforce doesn’t guarantee general availability of this feature within any particular time frame or at all, and we can discontinue it at any time. This feature is for evaluation purposes only, not for production use. It’s offered as is and isn’t supported, and Salesforce has no liability for any harm or damage arising out of or in connection with it. All restrictions, Salesforce reservation of rights, obligations concerning the Services, and terms for related Non-Salesforce Applications and Content apply equally to your use of this feature. You can provide feedback and suggestions for Apex Replay Debugger in the [Issues section](https://github.com/forcedotcom/salesforcedx-vscode/issues) of the salesforcedx-vscode repository on GitHub.

---

## Prerequisites
Before you set up Apex Replay Debugger, make sure that you have these essentials.

* **Salesforce CLI**  
  Before you use Salesforce Extensions for VS Code, [set up Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup). 
* **A Salesforce DX project**  
  See [Project Setup](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) in the _Salesforce DX Developer Guide_ for details.
* **An active default scratch org, or a local copy of a debug log from the org whose up-to-date source is in your Salesforce DX project**
  1. To create a scratch org, you need a Dev Hub. To set up your production org as a Dev Hub, see [Enable Dev Hub in Your Org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_enable_devhub.htm) in the _Salesforce DX Setup Guide_.  
  1. To authorize your Dev Hub, open VS Code’s command palette (Cmd+Shift+P on macOS, or Ctrl+Shift+P on Windows or Linux) and run **SFDX: Authorize a Dev Hub**.  
  1. To create a default scratch org, run **SFDX: Create a Default Scratch Org**. Then, run **SFDX: Push Source to Default Scratch Org**. For more information, see [Scratch Orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm) in the _Salesforce DX Developer Guide_.
* **[Visual Studio Code](https://code.visualstudio.com/download) v1.23 or later** 
* **The latest version of the [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) and [salesforcedx-vscode-apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex) extensions**  
We suggest that you install all extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) extension pack.

## Set Up Apex Replay Debugger
The first time that you use Apex Replay Debugger, create a launch configuration. Then, each time that you debug an issue, set up an Apex Replay Debugger session.

### Create a Launch Configuration
To create a launch configuration for Apex Replay Debugger, create or update your project’s `.vscode/launch.json` file.

1. Open your Salesforce DX project in VS Code.
1. If your Salesforce DX project doesn’t already contain a JSON file with the file path `.vscode/launch.json`, create the file (and, if necessary, the folder).
1. Open your `.vscode/launch.json` file.
1. Add a configuration named `Launch Apex Replay Debugger`.  
```
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Apex Replay Debugger",
      "type": "apex-replay",
      "request": "launch",
      "logFile": "${command:AskForLogFileName}",
      "stopOnEntry": true,
      "trace": true
    }
  ]
}
```

### Set Up an Apex Replay Debugger Session for a Scratch Org

If you’re debugging an issue in a scratch org, we provide tools to generate a debug log to replay. Enable logging, reproduce your issue, get your debug log from the scratch org, and then start a debugging session.

1. To enable logging, from VS Code, open the command palette (Cmd+Shift+P on macOS, or Ctrl+Shift+P on Windows or Linux) and run **SFDX: Turn On Apex Debug Log for Replay Debugger**.
1. Reproduce the scenario you want to debug. You can do this by:
    * Running **SFDX: Invoke Apex Tests**
    * Running **SFDX: Execute Anonymous Apex with Currently Selected Text**
    * Running **SFDX: Execute Anonymous Apex with Editor Contents**
    * Executing manual steps in your org in a web browser 
1. To get a list of debug logs in your org, run **SFDX: Get Apex Debug Logs**.
1. Click the log that you want to replay. The log downloads and opens in VS Code.
1. Run **SFDX: Launch Apex Replay Debugger with Current File**.

### Set Up an Apex Replay Debugger Session for a Sandbox or Production Org

If you’re not using a scratch org, download a debug log from your org before you start debugging. Open that log in VS Code and then start a debugging session.

1. In VS Code, open the debug log that you want to analyze. The log must be generated with a log level of `FINER` or `FINEST` for `VISUALFORCE` and a log level of `FINEST` for `APEX_CODE`.
1. Run **SFDX: Launch Apex Replay Debugger with Current File**.  

TIP: If your log file is part of your Salesforce DX project, you don’t need to open the log file and then run a separate command. Instead, you can find a log file in the Explorer view, right-click it, and select **Launch Apex Replay Debugger with Current File**.

## Debug Your Code

Set breakpoints, then replay your debug log and inspect your variables’ values.

1. To set line breakpoints, open a `.cls` or `.trigger` file and click the column to the left of the line numbers.
1. To switch to VS Code’s Debug view, click the bug icon on the left edge of the window.
1. To replay the code execution that was logged in your debug log until you hit your first breakpoint, click the green play icon in the Debug actions pane at the top of the editor.
1. Step through your code and examine the states of your variables in the VARIABLES section of the Debug view. For details, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code docs.
1. When you’ve stepped through all the logged events, the debugging session ends. If you want to start again at the beginning of the log, run **SFDX: Launch Apex Replay Debugger with Last Log File**.

## Considerations
Keep these considerations and known issues in mind when working with Apex Replay Debugger.

* You can replay only one debug log at a time. This limitation can make it difficult to debug asynchronous Apex, which produces multiple debug logs.
* You can’t replay a debug log generated by scheduled Apex.
* Long string variable values are truncated.
* When viewing a standard or custom object, you can drill down only to its immediate child variables (one level deep).
* You can’t expand a collection (a list, set, or map), because its members are shown in their string form.
* Modifying a collection does not update the collection variable in the VARIABLES section of the Debug view.
* You can’t set method or conditional breakpoints.
* You can’t evaluate or watch variables or expressions in the Debug view’s WATCH section.
* While debugging, right-clicking a variable in the VARIABLES section of the Debug view and selecting **Copy Value** works properly. However, **Copy as Expression** and **Add to Watch** don’t work as expected. 
  * **Copy as Expression** functions like Copy Value: It copies the variable’s value instead of copying the full variable name.
  * **Add to Watch** copies the variable’s value into the WATCH section, but because we don’t evaluate variables in this section you see only `<VariableValue>:<VariableValue>`.

## Bugs and Feedback
To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

## Resources

* YouTube—Salesforce Releases: [Platform Services: Apex Replay Debugger](https://www.youtube.com/watch?v=8GVuMT4MHWc)
* TrailheaDX ’18 session video: [Banish the Bugs: Apex Debuggers to the Rescue!](https://www.salesforce.com/video/2520334/)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.  

---
