# salesforcedx-vscode-apex-debugger
This extension enables VS Code to use the real-time Apex Debugger with your scratch orgs.

## Prerequisites
Before you set up the Apex Debugger, make sure that you have these essentials.

* At least one available Apex Debugger session in your Dev Hub org
    * One Apex Debugger session is included with Performance Edition orgs, Unlimited Edition orgs, and Partner Business Orgs.
    * To purchase Apex Debugger sessions for Enterprise Edition orgs, or to purchase more sessions for orgs that already have allocated sessions, contact Salesforce.
* [Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm) v41.1.0 or later
* The latest versions the [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) and [salesforcedx-vscode-apex-debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-debugger) extensions (we suggest that you install all extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) extension pack)

## Set Up the Apex Debugger
The first time that you use the Apex Debugger in VS Code, complete these setup steps.

1. Add the `DebugApex` feature to a scratch org definition file:  
  `"features": "DebugApex"`
1. In VS Code, run **SFDX: Create a Default Scratch Org**. 
1. Choose the scratch org definition file that includes the `DebugApex` feature.
1. When your scratch org is ready, assign permissions for the Apex Debugger to the org’s admin user.  
    1. In VS Code, run **SFDX: Open Default Scratch Org**.
    1. In your browser, from Setup, enter `Permission Sets` in the Quick Find box, then select **Permission Sets**.
    1. Create a permission set.
    1. Give the permission set a name that you can remember, such as `Debug Apex`.
    1. In the “Select the type of users who will use this permission set” section, choose **None** from the User License drop-down list. Choosing None lets you assign the permission set to more than one type of user.
    1. Save your changes.
    1. Click **System Permissions**.
    1. Click **Edit**.
    1. Enable **Debug Apex**. Enabling this permission enables the set of permissions that your user needs. 
    1. Save your changes.
    1. Click **Manage Assignments**.
    1. Click **Add Assignments**.
    1. Select the users to whom you want to assign the permission set, and then click **Assign**.
1. **Optional**: In VS Code, run **SFDX: Pull Source from Default Scratch Org**. Then, add your new permission set to your source control repository. If you have a copy of the permission set in your Salesforce DX project, you can assign permissions to scratch org users by running `sfdx force:user:permset:assign -n Your_Perm_Set_Name`.
1. In VS Code, create a launch configuration for the Apex Debugger.
    1. To open the Debug view, in the VS Code Activity Bar, click the bug icon (hover text: Debug).
    1. To open your `launch.json` file, click the gear icon (hover text: Open launch.json).
    1. Within the `"configurations"` array, add a `"Launch Apex Debugger"` configuration:
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
    1. Save your `launch.json` file.

## Debug Your Code
After you’ve set up the Apex Debugger, set breakpoints and start a debugging session. Then, debug your code.

To set a breakpoint, open a `.cls` or `.trigger` file and click the column to the left of the line numbers. Active breakpoints are red. Inactive breakpoints are grey. You can see a list of your breakpoints in the Breakpoints panel of the Debug view.

To start a debugging session, from the configuration dropdown menu at the top of the Debug view, select **Launch Apex Debugger**. Then, click the green play icon (hover text: Start Debugging).

While a debugging session is in progress, any synchronous activity that runs a line of code with a breakpoint causes execution to halt at the breakpoint. While execution is paused, you can inspect the call stack and see the current values of your variables. You can also step through your code, using the Debug actions pane that appears at the top of the editor while a debugging session is in progress, and watch those values change. You can debug up to two threads at a time. For more information, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code Docs.

## Whitelist Users and Request Types
To filter which requests are debugged, edit your `launch.json` file to set up whitelisting. If you don’t use whitelisting, all events in your org trigger debugging during a debugging session. Whitelist users or request types to focus only on the events that are relevant to the problem you’re debugging.

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

## Considerations
Keep these limitations and known issues in mind when working with the Apex Debugger.

* If you edit Apex classes while a debugging session is in progress, your breakpoints might not match your debugging output after you save your changes.  

* Your debugging session is orphaned when you close VS Code before stopping your session. If you have an orphaned session, you can’t start a new session. To stop your currently active session, in VS Code, run **SFDX: Stop Apex Debugger Session**. To manage your Dev Hub’s Apex Debugger sessions, go to Apex Debugger in Setup.  

* Eval functionality isn’t available.  

* Hot swapping isn’t permitted. These actions kill your debugging session.
    * Installing or uninstalling a package
    * Saving changes that cause your org’s metadata to recompile  
        ___
        You can’t save changes to these items during a debugging session:
        * Apex classes or triggers
        * Visualforce pages or components
        * Lightning resources
        * Permissions or preferences
        * Custom fields or custom objects  
        ___

* These entry points aren’t supported.
    * Asynchronously executed code, including asynchronous tests  
        ___
        Because synchronous execution of Apex tests isn’t supported for the `sfdx force:apex:test:run` command, VS Code can’t help you run Apex tests synchronously. Open the Developer Console to start your test runs.  
        ___ 
        **Tip**: Test code between a pair of `startTest` and `stopTest` methods can run synchronously. To debug your asynchronous functionality, use these methods within your tests.  
        ___
    * Batch, Queueable, and Scheduled Apex
    * Inbound email
    * Code with the `@future` annotation  

* Keep these things in mind when working with breakpoints.
    * You can’t set conditional breakpoints.
    * Breakpoints set on a get or set method must be within the method’s body.
    * You can’t set breakpoints in or step through Execute Anonymous blocks. However, when you hit a breakpoint using Execute Anonymous, we show your Execute Anonymous frame in the stack. To view your Execute Anonymous code’s variables, click this line in the stack.  

* Keep these things in mind when working with variables.
    * You can’t watch variables.
    * Variable inspection in dynamic Visualforce and Lightning components isn’t supported.
    * You can’t drill into the instance variables of Apex library objects. To view these objects’ contents, use their `toString` methods.
    * Variables declared within a loop are visible outside of the loop.
    * Drill into variables to see their children’s values. For example, if you run the query `[SELECT Id, ContactId, Contact.accountId, Contact.Account.ownerId FROM Case]`, your results are nested as follows.
        ```
        Case
        --> Contact
        -----> contactId
        -----> Account
        --------> accountId
        --------> ownerId
        ```
    * When you perform a SOQL query for variables from the EntityDefinition table, your results include the `durableId` even if you don’t explicitly `SELECT` that variable.

## Resources
* Visual Studio Code Docs: [Debugging](https://code.visualstudio.com/docs/editor/debugging)
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup)_
* _[Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode)_
* _Force.com IDE Developer Guide_: [Explore a Simple Debugging Puzzle](https://developer.salesforce.com/docs/atlas.en-us.eclipse.meta/eclipse/debugger_puzzle_parent.htm)
* GitHub: [salesforcedx-vscode-apex-debugger](https://github.com/forcedotcom/salesforcedx-vscode-apex-debugger)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Please consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.  

---