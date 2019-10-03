---
title: ISV Customer Debugger
lang: en
---

ISV Customer Debugger covers a gap in what you can do with Apex Debugger. As an ISV, you can debug your own code. As a subscriber, you can debug your own code. However, because of the protections against seeing managed code, subscribers can’t debug ISV code in their orgs. With ISV Customer Debugger, an ISV can work with a subscriber to debug issues specific to the subscriber’s org.

An ISV can reproduce issues in the specific environment, so problems can be diagnosed more quickly. You can debug only sandbox orgs.

## Configure ISV Customer Debugger

ISV Customer Debugger is part of the Apex Interactive Debugger (`salesforcedx-vscode-apex-debugger`) extension, so you don’t need to install anything other than the Salesforce Extension Pack and its prerequisites. You can debug only sandbox orgs.

1. Log in to your subscriber’s sandbox via your License Management Org (LMO). If you’re not familiar with this process, see the _ISVforce Guide_. For information on how to obtain login access to your subscriber’s org, see [Request Login Access from a Customer](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/lma_requesting_login_access.htm). For information on how to log in via the Subscriber Support Console, see [Logging In to Subscriber Orgs](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/lma_logging_in_to_sub_org.htm).
1. In your subscriber’s org, from Setup, enter **Apex Debugger** in the Quick Find box, then click **Apex Debugger**.
1. Click **Start Partner Debugging Session**.
1. In the Using Salesforce Extensions for VS Code section, to copy the `forceide://` URL, click **Copy to Clipboard**.
1. In VS Code, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS) to open the command palette, then run **SFDX: Create and Set Up Project for ISV Debugging**.
1. When directed, paste the `forceide://` URL into the prompt, and press Enter.
1. When directed, either accept the default project name or enter a name for your debugging project, and press Enter.
1. Choose a location to store the project, and click **Create Project**.
1. Wait for the project generation process to finish. VS Code retrieves your packaged metadata, your subscriber's metadata, and skeleton classes for other packages in the org, converts them to source format, and creates a Salesforce DX project. VS Code also creates a launch configuration (`launch.json` file) for the project. This process can take a long time, especially for orgs that contain lots of metadata, so feel free to leave it running and check back later. You can monitor the progress in the output panel at the bottom of VS Code. To show the output panel, select **View** > **Output**, then select **Salesforce CLI** from the dropdown menu in the corner of the Output tab.  
   When the project is ready, VS Code opens it for you in a new window.
1. In the new window, from the Explorer view, open an Apex class or trigger that you want to set breakpoints in.
1. To set a breakpoint, click the gutter to the left of the line numbers.
1. Switch to the Debug view.
1. To launch Apex Debugger, click the play icon next to the launch configuration dropdown menu.

## Debug Your Subscriber’s Org

With one noteworthy exception, debugging a subscriber’s org works the same way that debugging other orgs does. The exception: You can’t break on Apex events triggered by other users in the org. Only the Login As user can trigger Apex breakpoint hit events.

See the rest of this README for information about Apex Debugger. For general information about debugging in VS Code, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code docs.

## Renew a Debugging Session

If your session expires, start a new session from Setup using all the same steps that you followed when you started the original session.

## Protect Your Subscriber’s Intellectual Property

The code from your subscriber’s org is your subscriber’s intellectual property. We advise against keeping it around after you’re done debugging. Delete the entire project from the location where you stored it during the setup process. Never store your subscriber’s metadata in your version control system. When you start a new debugging session later, VS Code downloads the metadata for you again.

## ISV Customer Debugger Considerations

For general Apex Debugger limitations and known issues, see [Considerations](interactive-debugger#considerations) in the Apex Interactive Debugger article. When working with ISV Customer Debugger, keep these additional considerations in mind.

- You can debug only sandbox orgs.
- You can debug only one customer at a time. However, if you purchase Apex Debugger licenses, you can debug multiple customers at once. An Apex Debugger license also lets you debug in your sandboxes and scratch orgs.
- When you click Return to subscriber overview, your debugging session terminates. Stay logged in to your subscriber’s org while you debug, and return to your LMO only when you’re done debugging.
