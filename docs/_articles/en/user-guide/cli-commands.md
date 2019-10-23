---
title: Run Salesforce CLI Commands
lang: en
---

To run a command from Salesforce Extensions for VS Code, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS) and type **SFDX** in the command palette.  
![Command palette, filtered to show SFDX commands](./images/sfdx_commands.png)

When a command finishes running (due to success, failure, or cancellation), a notification displays at the top of the window.  
![Notification that source was successfully pushed to a scratch org](./images/command_success_notification.png)

To see the output of the commands that you run, select **View** > **Output**, and then select **Salesforce CLI** from the dropdown menu. Alternatively, click **Show** in the completion notification.  
![Output view, showing the results of an Apex test run](./images/output_view.png)

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
- `force:auth:web:login --setdefaultdevhubusername`: **SFDX: Authorize a Dev Hub**
- `force:config:list`: **SFDX: List All Config Variables**
- `force:data:soql:query`: **SFDX: Execute SOQL Query with Currently Selected Text**
- `force:data:soql:query ...`: **SFDX: Execute SOQL Query...**
- `force:lightning:app:create ...`: **SFDX: Create Lightning App**
- `force:lightning:component:create ...`: **SFDX: Create Lightning Component**
- `force:lightning:event:create ...`: **SFDX: Create Lightning Event**
- `force:lightning:interface:create ...`: **SFDX: Create Lightning Interface**
- `force:org:create --setdefaultusername ...`: **SFDX: Create a Default Scratch Org**
- `force:org:display`: **SFDX: Display Org Details for Default Scratch Org**
- `force:org:display --targetusername ...`: **SFDX: Display Org Details...**
- `force:org:open`: **SFDX: Open Default Org**
- `force:project:create --template standard ...`: **SFDX: Create Project**
- `force:project:create --template standard --manifest ...`: **SFDX: Create Project with Manifest**
- `force:source:delete`: **SFDX: Delete from Project and Org** (beta)
- `force:source:deploy`: **SFDX: Deploy Source to Org** (beta)
- `force:source:deploy --manifest ...`: **SFDX: Deploy Source in Manifest to Org** (beta)
- `force:source:pull`: **SFDX: Pull Source from Default Scratch Org**
- `force:source:pull --forceoverwrite`: **SFDX: Pull Source from Default Scratch Org and Override Conflicts**
- `force:source:push`: **SFDX: Push Source to Default Scratch Org**
- `force:source:push --forceoverwrite`: **SFDX: Push Source to Default Scratch Org and Override Conflicts**
- `force:source:retrieve`: **SFDX: Retrieve Source from Org** (beta)
- `force:source:retrieve --manifest ...`: **SFDX: Retrieve Source in Manifest from Org** (beta)
- `force:source:status`: **SFDX: View All Changes (Local and in Default Scratch Org)**
- `force:source:status --local`: **SFDX: View Local Changes**
- `force:source:status --remote`: **SFDX: View Changes in Default Scratch Org**
- `force:visualforce:component:create ...`: **SFDX: Create Visualforce Component**
- `force:visualforce:page:create ...`: **SFDX: Create Visualforce Page**
