---
title: Command Palette
lang: en
---

The Command Palette provides access to many commands for Salesforce development.

To run a command from Salesforce Extensions for VS Code, press Ctrl+Shift+P (Windows or Linux) or ⇧⌘P (macOS) and type **SFDX** in the command palette to see commands relevant to Salesforce development.

![Command palette, filtered to show SFDX commands](./images/sfdx_commands.png)

When a command finishes running (due to success, failure, or cancellation), a notification displays at the top of the window.  
![Notification that deleted and expired orgs were successfully removed](./images/command_success_notification.png)

To see the output of the commands that you run, select **View** > **Output**, and then select **Salesforce CLI** from the dropdown menu. Alternatively, click **Show** in the completion notification.

![Output view, showing the results of an Apex test run](./images/output_view.png)

To clear the output content between SFDX commands, select **Settings** > **User Settings** > **Salesforce Core Configuration** and check **Clear Output Tab**.
