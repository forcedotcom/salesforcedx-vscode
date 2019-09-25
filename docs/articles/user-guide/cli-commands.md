---
title: Run Salesforce CLI Commands
---

To run a command from Salesforce Extensions for VS Code, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS) and type **SFDX** in the command palette.  
![Command palette, filtered to show SFDX commands](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/sfdx_commands.png)

When a command finishes running (due to success, failure, or cancellation), a notification displays at the lower-right corner of the window.  
![Notification that source was successfully pushed to a scratch org](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/command_success_notification.png)

To see the output of the commands that you run, select **View** > **Output**, and then select **Salesforce CLI** from the dropdown menu. Alternatively, click **Show** in the completion notification.  
![Output view, showing the results of an Apex test run](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/output_view.png)

## Available Commands

These Salesforce CLI commands are available in Salesforce Extensions for VS Code:

- `force:alias:list`: **SFDX: List All Aliases**
- `force:apex:class:create ...`: **SFDX: Create Apex Class**
- `force:apex:execute`: **SFDX: Execute Anonymous Apex with Currently Selected Text**
- `force:apex:execute --apexcodefile`: **SFDX: Execute Anonymous Apex with Editor Contents**
- `force:apex:log:get ...`: **SFDX: Get Apex Debug Logs...**
- `force:apex:test:run --resultformat human ...`: **SFDX: Invoke Apex Tests...**
- `force:apex:trigger:create ...`: **SFDX: Create Apex Trigger**
- `force:auth:logout --all --noprompt`: **SFDX: Log Out from All Authorized Orgs**
- `force:auth:web:login --setdefaultdevhubusername`, `force:auth:device:login --setdefaultdevhubusername` (in remote development): **SFDX: Authorize a Dev Hub**
- `force:config:list`: **SFDX: List All Config Variables**
- `force:config:set --isvDebuggerSid --isvDebuggerUrl --instanceUrl`: **SFDX: Create and Set Up Project for ISV Debugging** (step 2)
- `force:data:record:create --sobjecttype --values --usetoolingapi`: **SFDX: Turn On Apex Debug Log for Replay Debugger**
- `force:data:record:delete --sobjecttype --sobjectid --usetoolingapi`: **SFDX: Turn Off Apex Debug Log for Replay Debugger**
- `force:data:soql:query`: **SFDX: Execute SOQL Query with Currently Selected Text**
- `force:data:soql:query ...`: **SFDX: Execute SOQL Query...**
- `force:lightning:app:create ...`: **SFDX: Create Lightning App**
- `force:lightning:component:create ...`: **SFDX: Create Lightning Web Component**
- `force:lightning:event:create ...`: **SFDX: Create Lightning Event**
- `force:lightning:interface:create ...`: **SFDX: Create Lightning Interface**
- `force:mdapi:retrieve --retrievetargetdir --unpacked --targetusername`: **Create and Set Up Project for ISV Debugging** (step 4)
- `force:mdapi:convert --rooter --outputdir force-app`: **Create and Set Up Project for ISV Debugging** (step 5)
- `force:package:installed:list --targetusername`: **Create and Set Up Project for ISV Debugging** (step 6)
- `force:org:create --setdefaultusername ...`: **SFDX: Create a Default Scratch Org**
- `force:org:display`: **SFDX: Display Org Details for Default Org**
- `force:org:display --targetusername ...`: **SFDX: Display Org Details...**
- `force:org:open`: **SFDX: Open Default Org**
- `force:project:create --template standard ...`: **SFDX: Create Project**
- `force:project:create --template standard --manifest ...`: **SFDX: Create Project with Manifest**
- `force:source:delete`: **SFDX: Delete from Project and Org**
- `force:source:deploy`: **SFDX: Deploy Source to Org**
- `force:source:deploy --manifest ...`: **SFDX: Deploy Source in Manifest to Org**
- `force:source:pull`: **SFDX: Pull Source from Default Scratch Org**
- `force:source:pull --forceoverwrite`: **SFDX: Pull Source from Default Scratch Org and Override Conflicts**
- `force:source:push`: **SFDX: Push Source to Default Scratch Org**
- `force:source:push --forceoverwrite`: **SFDX: Push Source to Default Scratch Org and Override Conflicts**
- `force:source:retrieve`: **SFDX: Retrieve Source from Org**
- `force:source:retrieve --manifest ...`: **SFDX: Retrieve Source in Manifest from Org**
- `force:source:status`: **SFDX: View All Changes (Local and in Default Scratch Org)**
- `force:source:status --local`: **SFDX: View Local Changes**
- `force:source:status --remote`: **SFDX: View Changes in Default Scratch Org**
- `force:visualforce:component:create ...`: **SFDX: Create Visualforce Component**
- `force:visualforce:page:create ...`: **SFDX: Create Visualforce Page**

For information about the Salesforce CLI commands and their parameters, see the [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference.htm).
