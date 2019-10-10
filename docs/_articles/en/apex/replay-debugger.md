---
title: Apex Replay Debugger
lang: en
---

## Set Up Apex Replay Debugger

The first time that you use Apex Replay Debugger, create a launch configuration. Then, each time that you debug an issue, set up an Apex Replay Debugger session.

### Create a Launch Configuration

To create a launch configuration for Apex Replay Debugger, create or update your project’s `.vscode/launch.json` file.

1. Open your Salesforce DX project in VS Code.
1. If your Salesforce DX project doesn’t already contain a JSON file with the file path `.vscode/launch.json`, create the file (and, if necessary, the folder).
1. Open your `.vscode/launch.json` file.
1. Add a configuration named `Launch Apex Replay Debugger`.

```json
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Apex Replay Debugger",
      "type": "apex-replay",
      "request": "launch",
      "logFile": "${command:AskForLogFileName}",
      "stopOnEntry": true,
      "trace": true
    }
  ]
}
```

### Set Breakpoints and Checkpoints

Before you generate a debug log for replay debugging, set breakpoints and checkpoints.

1.  To set line breakpoints, open a `.cls` or `.trigger` file and click the column to the left of the line numbers.
1.  For more information than line breakpoints provide, add checkpoints. You can set up to five checkpoints to get heap dumps when lines of code run. All local variables, static variables, and trigger context variables have better information at checkpoints. Trigger context variables don’t exist in logs and are available only at checkpoint locations.  
    In Visual Studio Code, a checkpoint is a type of breakpoint. Checkpoints function like breakpoints while replay debugging from a log. Set up and upload your checkpoints before you start an Apex Replay Debugger session.

    1.  Set checkpoints on up to five lines in Apex classes or triggers.
    1.  Click the line of code where you want to set the checkpoint.
    1.  Open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS).
    1.  Run **SFDX: Toggle Checkpoint**.
        - Or, right-click in the gutter to the left of the line numbers, select **Add Conditional Breakpoint** \| **Expression**, and set the expression to `Checkpoint`.
        - Or, to convert an existing breakpoint into a checkpoint, right-click the breakpoint, and select **Edit Breakpoint** \| **Expression**. Set the expression to `Checkpoint`.
    1.  To upload your checkpoints to your org to collect heap dump information, open the command palette, and run **SFDX: Update Checkpoints in Org**.

### Set Up an Apex Replay Debugger Session for a Scratch Org or a Default Development Org

If you’re debugging an issue in a scratch org, or in a sandbox or DE org that you’ve set as your default org in VS Code, we provide tools to generate a debug log to replay. Enable logging, reproduce your issue, get your debug log from the org, and then start a debugging session.

1. To enable logging, from VS Code, open the command palette (Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Turn On Apex Debug Log for Replay Debugger**.
1. Reproduce the scenario you want to debug. You can do this by:
   - Running **SFDX: Invoke Apex Tests**
   - Running **SFDX: Execute Anonymous Apex with Currently Selected Text**
   - Running **SFDX: Execute Anonymous Apex with Editor Contents**
   - Executing manual steps in your org in a web browser
1. To get a list of debug logs in your org, run **SFDX: Get Apex Debug Logs**.
1. Click the log that you want to replay. The log downloads and opens in VS Code.
1. Run **SFDX: Launch Apex Replay Debugger with Current File**.

### Set Up an Apex Replay Debugger Session for a Sandbox or Production Org

If you’re not using a scratch org or an org that you’ve set as your default org for development in VS Code, download a debug log from your org before you start debugging. Open that log in VS Code and then start a debugging session.

1. In VS Code, open the debug log that you want to analyze. Generate the log with a log level of `FINER` or `FINEST` for `VISUALFORCE` and a log level of `FINEST` for `APEX_CODE`.
1. Run **SFDX: Launch Apex Replay Debugger with Current File**.

TIP: If your log file is part of your Salesforce DX project, you don’t need to open the log file and then run a separate command. Instead, you can find a log file in the Explorer view, right-click it, and select **Launch Apex Replay Debugger with Current File**.

## Debug Your Code

Replay your debug log and inspect your variables’ values.

1. To switch to VS Code’s Debug view, click the bug icon on the left edge of the window.
1. To replay the code execution that was logged in your debug log until you hit your first breakpoint, click the green play icon in the Debug actions pane at the top of the editor.
1. Step through your code and examine the states of your variables in the VARIABLES section of the Debug view. For details, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code docs.  
   As you step through your code during a debugging session, Apex Replay Debugger provides details about your variables from heap dumps on lines where you set checkpoints.
1. When you’ve stepped through all the logged events, the debugging session ends. If you want to start again at the beginning of the log, run **SFDX: Launch Apex Replay Debugger with Last Log File**.

## Considerations

Keep these considerations and known issues in mind when working with Apex Replay Debugger.

- You can use this debugger only in your orgs. ISV customer debugging is unavailable in Apex Replay Debugger. To debug customers’ orgs, use [ISV Customer Debugger](./en/apex/interactive-debugger#isv-customer-debugger).
- You can replay only one debug log at a time. This limitation can make it difficult to debug asynchronous Apex, which produces multiple debug logs.
- Be sure to start a session soon after uploading your checkpoints, because checkpoints expire after 30 minutes.
- Be sure to debug your code soon after starting the session, because heap dumps expire about a day after you generate them.
- You can’t replay a debug log generated by scheduled Apex.
- Long string variable values are truncated at breakpoints. At checkpoints, heap-dump-augmented variables have full strings.
- When viewing a standard or custom object at a breakpoint, you can drill down only to the object’s immediate child variables (one level deep). At checkpoints, heap-dump-augmented variables have full drill-down to child standard objects, not only to immediate children.
- You can’t expand a collection (a list, set, or map), because its members are shown in their string form.
- Modifying a collection does not update the collection variable in the VARIABLES section of the Debug view.
- You can’t set method or conditional breakpoints.
- You can’t evaluate or watch variables or expressions in the Debug view’s WATCH section.
- While debugging, right-clicking a variable in the VARIABLES section of the Debug view and selecting **Copy Value** works properly. However, **Copy as Expression** and **Add to Watch** don’t work as expected.
  - **Copy as Expression** functions like Copy Value: It copies the variable’s value instead of copying the full variable name.
  - **Add to Watch** copies the variable’s value into the WATCH section, but because we don’t evaluate variables in this section you see only `<VariableValue>:<VariableValue>`.
