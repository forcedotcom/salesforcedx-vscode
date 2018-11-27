# Salesforce CLI Integration for Visual Studio Code

This extension enables VS Code to use the Salesforce CLI to interact with your orgs.

**For best results, do not install this extension directly. Install the complete [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) instead.**

## Prerequisites

Before you set up this extension, make sure that you have these essentials.

- **Salesforce CLI**  
  Before you use Salesforce Extensions for VS Code, [set up the Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup).
- **A Salesforce DX project**
  Open your Salesforce DX project in a directory that contains an `sfdx-project.json` file. Otherwise, some features don’t work.  
  If you don't already have a Salesforce DX project, create one with the **SFDX: Create Project** command (for development against scratch orgs) or the **SFDX: Create Project with Manifest** command (for development against sandboxes or DE orgs). Or, see [create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) for information about setting up a project using Salesforce CLI.
- **[Visual Studio Code](https://code.visualstudio.com/download) v1.26 or later**

## Set Up a Default Scratch Org

To access the Visual Studio Code command palette, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux). To create a scratch org and set it as your default org for development, run **SFDX: Authorize a Dev Hub** and then **SFDX: Create a Default Scratch Org**. Then, to push the source in your project to the scratch org, run **SFDX: Push Source to Default Scratch Org**. To open the org in your browser, run **SFDX: Open Default Org**. After you make changes in the Salesforce user interface, to pull those changes to your local project, run **SFDX: Pull Source from Default Scratch Org**.

## Develop Against Any Org in Visual Studio Code (Beta)

Connect to a sandbox or Developer Edition (DE) org to retrieve and deploy source from Visual Studio Code. You can connect to non-source-tracked orgs (orgs other than scratch orgs) in Salesforce Extensions for VS Code v44 and later.

---

As a beta feature, the ability to use VS Code with sandbox and production orgs is a preview and isn’t part of the “Services” under your master subscription agreement with Salesforce. Use this feature at your sole discretion, and make your purchase decisions only on the basis of generally available products and features. Salesforce doesn’t guarantee general availability of this feature within any particular time frame or at all, and we can discontinue it at any time. This feature is for evaluation purposes only, not for production use. It’s offered as is and isn’t supported, and Salesforce has no liability for any harm or damage arising out of or in connection with it. All restrictions, Salesforce reservation of rights, obligations concerning the Services, and terms for related Non-Salesforce Applications and Content apply equally to your use of this feature. You can provide feedback and suggestions for this functionality in the [Issues section](https://github.com/forcedotcom/salesforcedx-vscode/issues) of the salesforcedx-vscode repository on GitHub.

---

To access the Visual Studio Code command palette, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux). Then run these commands as needed.

- To log in to a sandbox or a DE org and set that org as the default org for your project, run **SFDX: Authorize an Org**.

  NOTE: Before you authorize a sandbox org, edit your `sfdx-project.json` file and set your `sfdcLoginUrl` value to `https://test.salesforce.com`:

  ```
  "sfdcLoginUrl": "https://test.salesforce.com"
  ```

- To generate a project with a manifest (with a `package.xml` file) to develop against orgs without source tracking (orgs that aren’t scratch orgs), run **SFDX: Create Project with Manifest**.

To retrieve source from an org without source tracking (from an org that’s not a scratch org), right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Retrieve Source from Org**. Or, right-click a file that’s open in the editor, and select **SFDX: Retrieve This Source File from Org**.

CAUTION: Retrieving source from an org overwrites your local versions of the source files.

To deploy source to an org without source tracking (to an org that’s not a scratch org), right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Deploy Source to Org**. Or, right-click a file that’s open in the editor, and select **SFDX: Deploy This Source File to Org**.

CAUTION: Deploying source to an org overwrites the metadata in your org with your local versions of the source files.

To delete source from your project and from your non-source-tracked org, right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Delete from Project and Org**. Or, right-click a file that’s open in the editor, and select **SFDX: Delete This from Project and Org**.

## View Your Default Org

A badge in the footer shows your default development org. It uses the org’s auto-generated username or the alias that you chose for the org. To open the org in your browser, click this badge.  
![Username for default scratch org, displayed in footer](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/active_scratch_org.png)

## Run Salesforce CLI Commands

To run a command from Salesforce Extensions for VS Code, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux) and type **SFDX** in the command palette.  
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
- `force:lightning:component:create ...`: **SFDX: Create Aura Component**
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
- `force:source:pull`: **SFDX: Pull Source from Default Scratch Org**
- `force:source:pull --forceoverwrite`: **SFDX: Pull Source from Default Scratch Org and Override Conflicts**
- `force:source:push`: **SFDX: Push Source to Default Scratch Org**
- `force:source:push --forceoverwrite`: **SFDX: Push Source to Default Scratch Org and Override Conflicts**
- `force:source:retrieve`: **SFDX: Retrieve Source from Org** (beta)
- `force:source:status`: **SFDX: View All Changes (Local and in Default Scratch Org)**
- `force:source:status --local`: **SFDX: View Local Changes**
- `force:source:status --remote`: **SFDX: View Changes in Default Scratch Org**
- `force:visualforce:component:create ...`: **SFDX: Create Visualforce Component**
- `force:visualforce:page:create ...`: **SFDX: Create Visualforce Page**

## View Your Running Tasks

To check your running tasks, expand the Running Tasks view in the Explorer.  
![Running Tasks view, showing that Apex tests are running](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-core/images/running_tasks.png)

## Apex Tests

You can run Apex tests from within a file or from the Apex Tests sidebar. The sidebar provides other useful features for working with your tests.

### Explore Your Apex Tests

The Apex Tests sidebar provides several features. Here, you can see all your Apex tests at a glance. You can run one test method, the test methods in one class, or all your tests. You can view the results of your last test run. And you can jump from those results to the corresponding lines in your code. To access this sidebar, click the beaker icon (hover text: Test) in the view bar on the left side of the VS Code window. (If you don’t see this icon, make sure that the project you have open in VS Code contains an `sfdx-project.json` file in its root directory.)

To run selected tests, in the Apex Tests view, hover over the name of a test method or class to reveal a play icon. Click the play icon (hover text: Run Single Test) to run a test method or all the methods in a class. To run all your tests, click the larger play icon at the top of the Apex Tests view (hover text: Run Tests).

After you run tests, the blue icons next to your classes and methods change to green icons (for passing tests) or red icons (for failing tests). To see details about your test runs, hover over the name of a test class in the sidebar.

To jump to the definition of a test class, a test method that passed, or a method that you haven’t run yet, click its name in the sidebar. If you click the name of a failed test method, you jump to the assert statement that failed.

To clear your test results, click the refresh icon at the top of the sidebar (hover text: Refresh Tests).

### Run Apex Tests from Within a File

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

- Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
- Doc: [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)
- Doc: [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)
- GitHub: [salesforcedx-vscode-core](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-core)

---

Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.

---
