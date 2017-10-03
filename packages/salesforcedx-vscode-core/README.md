# salesforcedx-vscode-core
This extension enables VS Code to use the Salesforce CLI to interact with your scratch orgs.  

For best results, use this extension with the other extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) bundle.  

---
This release contains a beta version of Salesforce Development Tools for Visual Studio Code, which means it’s a high-quality feature with known limitations. Salesforce Development Tools for Visual Studio Code isn’t generally available unless or until Salesforce announces its general availability in documentation or in press releases or public statements. We can’t guarantee general availability within any particular time frame or at all. Make your purchase decisions only on the basis of generally available products and features. You can provide feedback and suggestions for Salesforce Development Tools for Visual Studio Code in the [Salesforce DX Beta](https://success.salesforce.com/_ui/core/chatter/groups/GroupProfilePage?g=0F93A000000HTp1) group in the Success Community.

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Please consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.    

## Run Salesforce CLI Commands
To run a command from the Salesforce Development Tools for Visual Studio Code extensions, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux) and type **SFDX** in the command palette.  
![Command palette, filtered to show SFDX commands](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/sfdx_commands.png)

When a command finishes running (due to success, failure, or cancellation), a notification displays at the top of the window.  
![Notification that source was successfully pushed to a scratch org](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/command_success_notification.png)

To see the output of the commands that you run, select **View** > **Output**, and then select **Salesforce DX CLI** from the dropdown menu. Alternatively, click **Show** in the completion notification.  
![Output view, showing the results of an Apex test run](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/output_view.png)  

These Salesforce CLI commands are available:
* `force:alias:list`: **SFDX: List All Aliases**
* `force:apex:class:create ...`: **SFDX: Create Apex Class**
* `force:apex:test:run --resultformat human ...`: **SFDX: Invoke Apex Tests...**
* `force:auth:web:login --setdefaultdevhubusername`: **SFDX: Authorize a Dev Hub**
* `force:config:list`: **SFDX: List All Config Variables**
* `force:data:soql:query ...`: **SFDX: Execute SOQL Query...**
* `force:lightning:app:create ...`: **SFDX: Create Lightning App**
* `force:lightning:component:create ...`: **SFDX: Create Lightning Component**
* `force:lightning:event:create ...`: **SFDX: Create Lightning Event**
* `force:lightning:interface:create ...`: **SFDX: Create Lightning Interface**
* `force:org:create --setdefaultusername ...`: **SFDX: Create a Default Scratch Org**
* `force:org:display`: **SFDX: Display Org Details for Default Scratch Org**
* `force:org:display --targetusername ...`: **SFDX: Display Org Details...**
* `force:org:open`: **SFDX: Open Default Scratch Org**
* `force:source:pull`: **SFDX: Pull Source from Default Scratch Org**
* `force:source:pull --forceoverwrite`: **SFDX: Pull Source from Default Scratch Org and Override Conflicts**
* `force:source:push`: **SFDX: Push Source to Default Scratch Org**
* `force:source:push --forceoverwrite`: **SFDX: Push Source to Default Scratch Org and Override Conflicts**
* `force:visualforce:component:create ...`: **SFDX: Create Visualforce Component**
* `force:visualforce:page:create ...`: **SFDX: Create Visualforce Page**

## View Your Active Scratch Org
A badge in the footer shows your current default scratch org. It uses the org’s auto-generated username or the alias that you chose for the org.  
![Username for default scratch org, displayed in footer](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/active_scratch_org.png)

## View Your Running Tasks
To check your running tasks, expand the Running Tasks view in the Explorer.  
![Running Tasks view, showing that Apex tests are running](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/running_tasks.png)

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Developer Guide (Beta)](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* _[Salesforce CLI Command Reference (Beta)](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)_
* Success Community: [Salesforce DX Beta](https://success.salesforce.com/_ui/core/chatter/groups/GroupProfilePage?g=0F93A000000HTp1)
* GitHub: [salesforcedx-vscode-core](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-core)
