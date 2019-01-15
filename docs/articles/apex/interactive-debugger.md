---
title: Apex Debugger
---

## Introduction

Apex Debugger allows customers to debug their Apex code on sandbox instances (including in scratch orgs), in real time, using VS Code as the client. You can use it to:

- Set breakpoints in Apex classes and triggers.
- View variables, including sObject types, collections, and Apex System types.
- View the call stack, including triggers activated by Apex Data Manipulation Language (DML), method-to-method calls, and variables.
- Interact with global classes, exceptions, and triggers from your installed managed packages. (When you inspect objects that have managed types that aren’t visible to you, only global variables are displayed in the variable inspection pane.)
- Complete standard debugging actions, including step into, over, and out, and run to breakpoint.
- Output your results to the Debug Console.

## Set Up Apex Debugger

The first time that you use Apex Debugger in VS Code, complete these setup steps.

1. Add the `DebugApex` feature to the scratch org definition files for all the types of scratch orgs that you plan to debug:  
   `"features": "DebugApex"`
1. In VS Code, run **SFDX: Create a Default Scratch Org**.
1. Choose a scratch org definition file that includes the `DebugApex` feature.
1. When your scratch org is ready, assign permissions for Apex Debugger to the org’s admin user.
   1. In VS Code, run **SFDX: Open Default Org**.
   1. In your browser, from Setup, enter `Permission Sets` in the Quick Find box, then select **Permission Sets**.
   1. Click **New**.
   1. Give the permission set a name that you can remember, such as `Debug Apex`.
   1. In the “Select the type of users who will use this permission set” section, choose **None** from the User License dropdown list. Choosing None lets you assign the permission set to more than one type of user.
   1. Save your changes.
   1. Click **System Permissions**.
   1. Click **Edit**.
   1. Enable **Debug Apex**. The other permissions that Debug Apex requires are added automatically.
   1. Save your changes.
   1. Click **Manage Assignments**.
   1. Click **Add Assignments**.
   1. Select the users to whom you want to assign the permission set, and then click **Assign**.
   1. Click **Done**.
1. **Optional**: In VS Code, run **SFDX: Pull Source from Default Scratch Org**. Then, add your new permission set to your source control repository. If you have a copy of the permission set in your Salesforce DX project, you can assign permissions to scratch org users by running `sfdx force:user:permset:assign -n Your_Perm_Set_Name`.
1. In VS Code, create a launch configuration for Apex Debugger.
   1. To open the Debug view, in the VS Code Activity Bar, click the bug icon (hover text: Debug).
   1. To create a `launch.json` file, click the gear icon (hover text: Configure or Fix launch.json) and then select **Apex Debugger**. (If you’ve already created this file, clicking the gear icon opens the file.)
   1. Within the `"configurations"` array, add a `"Launch Apex Debugger"` configuration. The minimum information it should contain:
      ```
      "configurations": [
          {
              "name": "Launch Apex Debugger",
              "type": "apex",
              "request": "launch",
              "sfdxProject": "${workspaceRoot}"
          }
      ]
      ```
   1. Save your `launch.json` file. Each project needs only one `launch.json` file, even if you work with multiple scratch orgs. This file lives in the project’s `.vscode` directory.

## Debug Your Code

Nice job! You’ve set up Apex Debugger. Now, set breakpoints and start a debugging session. Then, debug your code.

To set a line breakpoint, open a `.cls` or `.trigger` file and click the column to the left of the line numbers. Active breakpoints are red. Inactive breakpoints are grey. You can see a list of your breakpoints in the Breakpoints panel of the Debug view.

To start a debugging session, from the configuration dropdown menu at the top of the Debug view, select **Launch Apex Debugger**. Then, click the green play icon (hover text: Start Debugging).

While a debugging session is in progress, any synchronous activity that runs a line of code with a breakpoint causes execution to halt at the breakpoint. While execution is paused, you can inspect the call stack and see the current values of your variables. You can also step through your code, using the Debug actions pane that appears at the top of the editor while a debugging session is in progress, and watch those values change. You can debug up to two threads at a time. For more information, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code docs.

## Set Exception Breakpoints

To make Apex Debugger halt execution when an exception is thrown during a debugging session, set breakpoints on exceptions. When an exception breakpoint is hit, the debugger pauses on the line of code that caused the exception. The Call Stack panel in the Debug view shows the name of the exception.

To set an exception breakpoint, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux) to open the command palette, then select **Apex Debug: Configure Exceptions**. The list of available exceptions includes the [exceptions in the `System` namespace](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_exception_methods.htm) and the Apex classes in your project that extend `Exception`. Select an exception from the list, and then select **Always break**.

To see your exception breakpoints, run **Apex Debug: Configure Exceptions**. The top of the list shows the exception classes that have active breakpoints, labeled `Always break`. To remove an exception breakpoint, select an exception from the list and then select **Never break**.

When you close VS Code, all your exception breakpoints are removed. (Your line breakpoints, however, remain.)

## Whitelist Users and Request Types

To filter which requests are debugged, edit your `launch.json` file to set up whitelisting. (The `launch.json` file lives in your project’s `.vscode` directory.) If you don’t use whitelisting, all events in your org trigger debugging during a debugging session. Whitelist users or request types to focus only on the events that are relevant to the problem you’re debugging.

Add filters to the `"Launch Apex Debugger"` configuration:

```
    "configurations": [
        {
            "name": "Launch Apex Debugger",
            "type": "apex",
            "request": "launch",
            "sfdxProject": "${workspaceRoot}"
            "userIdFilter": [],
            "requestTypeFilter": [],
            "entryPointFilter": ""
        }
    ]
```

To auto-complete potential request type values for `"requestTypeFilter"`, press Ctrl+Space.

To filter by entry point, enter a regular expression as the value for `"entryPointFilter"`. For example, to whitelist requests made by the Visualforce page `MyPage`, enter `".*/apex/MyPage.apexp"`.

## ISV Customer Debugger

ISV Customer Debugger covers a gap in what you can do with Apex Debugger. As an ISV, you can debug your own code. As a subscriber, you can debug your own code. However, because of the protections against seeing managed code, subscribers can’t debug ISV code in their orgs. With ISV Customer Debugger, an ISV can work with a subscriber to debug issues specific to the subscriber’s org.

An ISV can reproduce issues in the specific environment, so problems can be diagnosed more quickly. You can debug only sandbox orgs.

### Configure ISV Customer Debugger

ISV Customer Debugger is part of the `salesforcedx-vscode-apex-debugger` extension, so you don’t need to install anything other than this extension and its prerequisites. You can debug only sandbox orgs.

1. Log in to your subscriber’s sandbox via your License Management Org (LMO). If you’re not familiar with this process, see the _ISVforce Guide_. For information on how to obtain login access to your subscriber’s org, see [Request Login Access from a Customer](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/lma_requesting_login_access.htm). For information on how to log in via the Subscriber Support Console, see [Logging In to Subscriber Orgs](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/lma_logging_in_to_sub_org.htm).
1. In your subscriber’s org, from Setup, enter **Apex Debugger** in the Quick Find box, then click **Apex Debugger**.
1. Click **Start Partner Debugging Session**.
1. In the Using Salesforce Extensions for VS Code section, to copy the `forceide://` URL, click **Copy to Clipboard**.
1. In VS Code, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux) to open the command palette, then run **SFDX: Create and Set Up Project for ISV Debugging**.
1. When directed, paste the `forceide://` URL into the prompt, and press Enter.
1. When directed, either accept the default project name or enter a name for your debugging project, and press Enter.
1. Choose a location to store the project, and click **Create Project**.
1. Wait for the project generation process to finish. VS Code retrieves your packaged metadata, your subscriber's metadata, and skeleton classes for other packages in the org, converts them to source format, and creates a Salesforce DX project. VS Code also creates a launch configuration (`launch.json` file) for the project. This process can take a long time, especially for orgs that contain lots of metadata, so feel free to leave it running and check back later. You can monitor the progress in the output panel at the bottom of VS Code. To show the output panel, select **View** > **Output**, then select **Salesforce CLI** from the dropdown menu in the corner of the Output tab.  
   When the project is ready, VS Code opens it for you in a new window.
1. In the new window, from the Explorer view, open an Apex class or trigger that you want to set breakpoints in.
1. To set a breakpoint, click the gutter to the left of the line numbers.
1. Switch to the Debug view.
1. To launch Apex Debugger, click the play icon next to the launch configuration dropdown menu.

### Debug Your Subscriber’s Org

With one noteworthy exception, debugging a subscriber’s org works the same way that debugging other orgs does. The exception: You can’t break on Apex events triggered by other users in the org. Only the Login As user can trigger Apex breakpoint hit events.

See the rest of this README for information about Apex Debugger. For general information about debugging in VS Code, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code docs.

### Renew a Debugging Session

If your session expires, start a new session from Setup using all the same steps that you followed when you started the original session.

### Protect Your Subscriber’s Intellectual Property

The code from your subscriber’s org is your subscriber’s intellectual property. We advise against keeping it around after you’re done debugging. Delete the entire project from the location where you stored it during the setup process. Never store your subscriber’s metadata in your version control system. When you start a new debugging session later, VS Code downloads the metadata for you again.

## Considerations

Keep these limitations and known issues in mind when working with Apex Debugger.

### General Considerations

- If you edit Apex classes while a debugging session is in progress, your breakpoints might not match your debugging output after you save your changes.

- Your debugging session is orphaned when you close VS Code before stopping your session. If you have an orphaned session, you can’t start a new session. To stop your active session, in VS Code, run **SFDX: Stop Apex Debugger Session**. To manage your Dev Hub’s Apex Debugger sessions, go to Apex Debugger in Setup.

- Eval functionality isn’t available.

- Hot swapping isn’t permitted. These actions kill your debugging session:
  - Installing or uninstalling a package
  - Saving changes that cause your org’s metadata to recompile
    ***
    You can’t save changes to these items during a debugging session:
    - Apex classes or triggers
    - Visualforce pages or components
    - Lightning resources
    - Permissions or preferences
    - Custom fields or custom objects
    ***

### Considerations for Entry Points

These entry points aren’t supported:

- Asynchronously executed code, including asynchronous tests
  ***
  **Tip**: Code that’s between a pair of `startTest` and `stopTest` methods can run synchronously. To debug your asynchronous functionality, use these methods within your tests.
  ***
- Batch, Queueable, and Scheduled Apex
- Inbound email
- Code with the `@future` annotation

### Considerations for Breakpoints

- You can’t set conditional breakpoints.
- Breakpoints set on a `get` or `set` method must be within the method’s body.
- You can’t set breakpoints in or step through Execute Anonymous blocks. However, when you hit a breakpoint using Execute Anonymous, we show your Execute Anonymous frame in the stack. To view your Execute Anonymous code’s variables, click this line in the stack.

### Considerations for Variables

- You can’t watch variables.
- Variable inspection in dynamic Visualforce and Lightning components isn’t supported.
- You can’t drill into the instance variables of Apex library objects. To view these objects’ contents, use their `toString` methods.
- Variables declared within a loop are visible outside of the loop.
- Drill into variables to see their children’s values. For example, if you run the query `[SELECT Id, ContactId, Contact.accountId, Contact.Account.ownerId FROM Case]`, your results are nested as follows.
  ```
  Case
  --> Contact
  -----> contactId
  -----> Account
  --------> accountId
  --------> ownerId
  ```
- When you perform a SOQL query for variables from the EntityDefinition table, your results include the `durableId` even if you don’t explicitly `SELECT` that variable.

### ISV Customer Debugger Considerations

- You can debug only sandbox orgs.
- You can debug only one customer at a time. However, if you purchase Apex Debugger licenses, you can debug multiple customers at once. An Apex Debugger license also lets you debug in your sandboxes and scratch orgs.
- When you click Return to subscriber overview, your debugging session terminates. Stay logged in to your subscriber’s org while you debug, and return to your LMO only when you’re done debugging.

## Troubleshooting

### How do I know whether the Apex Debugger extension is installed?

In the VS Code menu bar, select **View** > **Extensions**. If the extension is installed, the list on the left includes "Apex Interactive Debugger".

There is an unofficial debugger extension that conflicts with ours: https://marketplace.visualstudio.com/items?itemName=chuckjonas.apex-debug. Please disable that extension while using ours.

### What is required on my computer and in my Dev Hub org?

Make sure that you have all the [prerequisites](../getting-started/install).

### How do I configure my scratch org so I can use Apex Debugger?

See these [instructions](#set-up-apex-debugger).

### How do I see errors from the Apex Debugger extension?

Add `"trace": "all"` in your `launch.json` file. Then, re-run your scenario to view debugger log lines in VS Code’s Debug Console.
