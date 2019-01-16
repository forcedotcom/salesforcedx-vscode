## Set Up a Default Scratch Org

To access the Visual Studio Code command palette, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS). Then:

- To create a scratch org and set it as your default org for development, run **SFDX: Authorize a Dev Hub** and then **SFDX: Create a Default Scratch Org**.
- To push the source in your project to the scratch org, run **SFDX: Push Source to Default Scratch Org**.
- To open the org in your browser, run **SFDX: Open Default Org**.
- After you make changes in the Salesforce user interface, to pull those changes to your local project, run **SFDX: Pull Source from Default Scratch Org**.

To access the Visual Studio Code command palette, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS). Then run these commands as needed.

- To log in to a sandbox or a DE org and set that org as the default org for your project, run **SFDX: Authorize an Org**.

- To generate a project with a manifest (with a `package.xml` file) to develop against orgs without source tracking (orgs that aren’t scratch orgs), run **SFDX: Create Project with Manifest**.

- To retrieve source from an org without source tracking (from an org that’s not a scratch org), you can:

  - Run **SFDX: Retrieve Source in Manifest from Org**.
  - Right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Retrieve Source from Org**.
  - Right-click a file that’s open in the editor, and select **SFDX: Retrieve This Source File from Org**.

  CAUTION: Retrieving source from an org overwrites your local versions of the source files.

- To deploy source to an org without source tracking (to an org that’s not a scratch org), you can:

  - Run **SFDX: Deploy Source in Manifest to Org**.
  - Right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Deploy Source to Org**.
  - Right-click a file that’s open in the editor, and select **SFDX: Deploy This Source File to Org**.
  - Deploy files each time you save them by setting the user or workspace setting `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` to `true`.

  CAUTION: Deploying source to an org overwrites the metadata in your org with your local versions of the source files.

- To delete source from your project and from your non-source-tracked org, you can:
  - Right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Delete from Project and Org**.
  - Right-click a file that’s open in the editor, and select **SFDX: Delete This from Project and Org**.

## View Your Default Org

A badge in the footer shows your default development org. It uses the org’s auto-generated username or the alias that you chose for the org. To open the org in your browser, click this badge.  
![Username for default scratch org, displayed in footer](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/active_scratch_org.png)

## Run Salesforce CLI Commands

To run a command from Salesforce Extensions for VS Code, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS) and type **SFDX** in the command palette.  
![Command palette, filtered to show SFDX commands](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/sfdx_commands.png)

When a command finishes running (due to success, failure, or cancellation), a notification displays at the top of the window.  
![Notification that source was successfully pushed to a scratch org](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/command_success_notification.png)

To see the output of the commands that you run, select **View** > **Output**, and then select **Salesforce CLI** from the dropdown menu. Alternatively, click **Show** in the completion notification.  
![Output view, showing the results of an Apex test run](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/output_view.png)

These Salesforce CLI commands are available:

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
- `force:project:create ...`: **SFDX: Create Project**
- `force:project:create --manifest ...`: **SFDX: Create Project with Manifest**
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

## View Your Running Tasks

To check your running tasks, expand the Running Tasks view in the Explorer.  
![Running Tasks view, showing that Apex tests are running](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/running_tasks.png)

## Edit Your Workspace Settings

To edit your workspace settings, select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).

To stop Salesforce CLI success messages from showing as pop-up information messages, click **Show Only in Status Bar** in a success message. This button overrides the `salesforcedx-vscode-core.show-cli-success-msg` value in your Default Settings. It changes the Workspace Settings value to `false`. Setting this value to `false` makes the success messages appear in the status bar (in VS Code’s footer) instead of as information messages. If you decide that you liked the information messages after all, change the value back to `true`.

To see the other settings for this extension pack, search the settings for `salesforcedx-vscode`.

## Activate Demo Mode

If you’re setting up a machine to use for demos at a conference (or for other public use), set up demo mode. When in demo mode, VS Code warns users who authorize business or production orgs of the potential security risks of using these orgs on shared machines.

To activate demo mode, add an environment variable called `SFDX_ENV` and set its value to `DEMO`: `SFDX_ENV=DEMO`.

When you’re done with your event, run **SFDX: Log Out from All Authorized Orgs**.
