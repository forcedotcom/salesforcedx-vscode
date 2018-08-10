# Salesforce CLI Integration for Visual Studio Code
This extension enables VS Code to use the Salesforce CLI to interact with your scratch orgs.  

For best results, use this extension with the other extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) bundle.  

##  Prerequisites
Before you set up this extension, make sure that you have these essentials.

* **Salesforce CLI and a Salesforce DX project**  
  Before you use Salesforce Extensions for VS Code, [set up the Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup) and [create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm).  
  Open your Salesforce DX project in a directory that contains an `sfdx-project.json` file. Otherwise, some features don’t work.  
* **[Visual Studio Code](https://code.visualstudio.com/download) v1.23 or later**  

## Run Salesforce CLI Commands
To run a command from Salesforce Extensions for VS Code, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux) and type **SFDX** in the command palette.  
![Command palette, filtered to show SFDX commands](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/sfdx_commands.png)

When a command finishes running (due to success, failure, or cancellation), a notification displays at the top of the window.  
![Notification that source was successfully pushed to a scratch org](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/command_success_notification.png)

To see the output of the commands that you run, select **View** > **Output**, and then select **Salesforce CLI** from the dropdown menu. Alternatively, click **Show** in the completion notification.  
![Output view, showing the results of an Apex test run](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/output_view.png)  

These Salesforce CLI commands are available:
* `force:alias:list`: **SFDX: List All Aliases**
* `force:apex:class:create ...`: **SFDX: Create Apex Class**
* `force:apex:execute`: **SFDX: Execute Anonymous Apex with Currently Selected Text**
* `force:apex:execute --apexcodefile`: **SFDX: Execute Anonymous Apex with Editor Contents**
* `force:apex:log:get ...`: **SFDX: Get Apex Debug Logs...**
* `force:apex:test:run --resultformat human ...`: **SFDX: Invoke Apex Tests...**
* `force:apex:trigger:create ...`: **SFDX: Create Apex Trigger**
* `force:auth:logout --all --noprompt`: **SFDX: Log Out from All Authorized Orgs**
* `force:auth:web:login --setdefaultdevhubusername`: **SFDX: Authorize a Dev Hub**
* `force:config:list`: **SFDX: List All Config Variables**
* `force:data:soql:query`: **SFDX: Execute SOQL Query with Currently Selected Text**
* `force:data:soql:query ...`: **SFDX: Execute SOQL Query...**
* `force:lightning:app:create ...`: **SFDX: Create Lightning App**
* `force:lightning:component:create ...`: **SFDX: Create Lightning Component**
* `force:lightning:event:create ...`: **SFDX: Create Lightning Event**
* `force:lightning:interface:create ...`: **SFDX: Create Lightning Interface**
* `force:org:create --setdefaultusername ...`: **SFDX: Create a Default Scratch Org**
* `force:org:display`: **SFDX: Display Org Details for Default Scratch Org**
* `force:org:display --targetusername ...`: **SFDX: Display Org Details...**
* `force:org:open`: **SFDX: Open Default Scratch Org**
* `force:project:create ...`: **SFDX: Create Project**
* `force:source:pull`: **SFDX: Pull Source from Default Scratch Org**
* `force:source:pull --forceoverwrite`: **SFDX: Pull Source from Default Scratch Org and Override Conflicts**
* `force:source:push`: **SFDX: Push Source to Default Scratch Org**
* `force:source:push --forceoverwrite`: **SFDX: Push Source to Default Scratch Org and Override Conflicts**
* `force:source:status`: **SFDX: View All Changes (Local and in Default Scratch Org)**
* `force:source:status --local`: **SFDX: View Local Changes**
* `force:source:status --remote`: **SFDX: View Changes in Default Scratch Org**
* `force:visualforce:component:create ...`: **SFDX: Create Visualforce Component**
* `force:visualforce:page:create ...`: **SFDX: Create Visualforce Page**

## View Your Active Scratch Org
A badge in the footer shows your current default scratch org. It uses the org’s auto-generated username or the alias that you chose for the org.  
![Username for default scratch org, displayed in footer](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/active_scratch_org.png)

## View Your Running Tasks
To check your running tasks, expand the Running Tasks view in the Explorer.  
![Running Tasks view, showing that Apex tests are running](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/running_tasks.png)

## Run Apex Tests
To run Apex tests, in your `.cls` file, click **Run Test** or **Run All Tests** above the definition of an Apex test method or class.  
![Running Apex tests using the Run Test and Run All Tests code lenses](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/apex_test_run.gif)

Results from your test run display in the Output panel. The Failures section of the output lists stack traces for failed tests. To navigate to the line of code that caused a failure, press Cmd (macOS) or Ctrl (Windows and Linux) and click that stack trace.  

After you run Apex tests, two new commands are available in the command palette: **SFDX: Re-Run Last Invoked Apex Test Class** and **SFDX: Re-Run Last Invoked Apex Test Method**.  

To retrieve code coverage results when you run Apex tests, edit your workspace settings and set `salesforcedx-vscode-core.retrieve-test-code-coverage` to `true`.  

## Edit Your Workspace Settings
To edit your workspace settings, select **Code** > **Preferences** > **Settings** (macOS) or **File** > **Preferences** > **Settings** (Windows and Linux).  

To stop Salesforce CLI success messages from showing as pop-up information messages, click **Show Only in Status Bar** in a success message. This button overrides the `salesforcedx-vscode-core.show-cli-success-msg` value in your Default Settings. It changes the Workspace Settings value to `false`. Setting this value to `false` makes the success messages appear in the status bar (in VS Code’s footer) instead of as information messages. If you decide that you liked the information messages after all, change the value back to `true`.   

## Activate Demo Mode
If you’re setting up a machine to use for demos at a conference (or for other public use), set up demo mode. When in demo mode, VS Code warns users who authorize business or production orgs of the potential security risks of using these orgs on shared machines.  

To activate demo mode, add an environment variable called `SFDX_ENV` and set its value to `DEMO`: `SFDX_ENV=DEMO`.  

When you’re done with your event, run **SFDX: Log Out from All Authorized Orgs**.  

## Bugs and Feedback
To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* _[Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)_
* GitHub: [salesforcedx-vscode-core](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-core)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.    

---
