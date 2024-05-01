---
title: Apex Replay Debugger
lang: en
---

## Overview

The Apex Replay Debugger can be used with all unmanaged code in all orgs. It works with Apex classes, triggers, anonymous Apex, and log files. This is an easy-to-use debugger that fits the majority of debugging use cases. It’s a good gateway into your debugging journey – scale up to other debuggers as needed.

## Set Breakpoints and Checkpoints

Before you generate a debug log for replay debugging, set breakpoints and checkpoints. Breakpoints can be set on the fly and don’t require a deploy. Checkpoints are a snapshot of all objects in an org at a certain point in time. Checkpoints have to be redeployed every time they’re set.

1.  To set line breakpoints, open a `.cls` or `.trigger` file and click the column to the left of the line numbers.
2.  For more information than line breakpoints provide, add checkpoints. You can set up to five checkpoints to get heap dumps when lines of code run. All local variables, static variables, and trigger context variables have better information at checkpoints. Trigger context variables don’t exist in logs and are available only at checkpoint locations.  
    In Visual Studio Code, a checkpoint is a type of breakpoint. Checkpoints function like breakpoints while replay debugging from a log. Set up and upload your checkpoints before you start an Apex Replay Debugger session.

    1.  Set checkpoints on up to five lines in Apex classes or triggers.
    2.  Click the line of code where you want to set the checkpoint.
    3.  Open the Command Palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS).
    4.  Run **SFDX: Toggle Checkpoint**.
        - Or, right-click in the gutter to the left of the line numbers, select **Add Conditional Breakpoint** \| **Expression**, and set the expression to `Checkpoint`.
        - Or, to convert an existing breakpoint into a checkpoint, right-click the breakpoint, and select **Edit Breakpoint** \| **Expression**. Set the expression to `Checkpoint`.
    5.  To upload your checkpoints to your org to collect heap dump information, open the Command Palette, and run **SFDX: Update Checkpoints in Org**.

## Easy Debugging

Quickly debug your Apex development work without explicitly setting trace flags:

1. Open your Apex test class or Anonymous Apex class with checkpoints or breakpoints set up.
2. Run **SFDX: Launch Apex Replay Debugger with Current File** from the Command Palette (or select the command by right-clicking inside an open file). You can invoke this command on an Apex test file, Anonymous Apex file or an Apex log file.

The command updates checkpoints in your org, sets (and deletes upon completion) trace flags, and generates a new debug log. For an Anonymous Apex file, a new log file opens in a window.

## Replay Debugger Setup

Set up Apex Replay Debugger for debugging more complicated issues such as Queuable Apex or Apex trigger issues in your org:

1. Open the Command Palette, and run **SFDX: Update Checkpoints in Org** to upload your checkpoints to your org to collect heap dump information. 
**Note**:  If you modify your Apex code or toggle checkpoints, run this command again to stay in sync.
2.  Run **SFDX: Turn On Apex Debug Log for Replay Debugger**.
3.  In your org, reproduce the issue that you’re debugging. 
4.  Get a list of debug logs in your org, run **SFDX: Get Apex Debug Logs**.
5.  Click the log that you want to replay. The log downloads and opens in VS Code.
6.  Run **SFDX: Launch Apex Replay Debugger with Current File**.

When you’ve stepped through all the logged events, the debugging session ends. If you want to start again at the beginning of the log, run **SFDX: Launch Apex Replay Debugger with Last Log File**. If you set different checkpoints, upload them again and repeat the steps.

## Replay Debug Logs

Replay your debug log and inspect your variables’ values.

1. To switch to VS Code’s Debug view, click the bug icon on the left edge of the window.
2. To replay the code execution that was logged in your debug log until you hit your first breakpoint, click the green play icon in the Debug actions pane at the top of the editor.
3. Open the log file.
4. Step through your code and examine the states of your variables in the VARIABLES section of the Debug view. For details, see [Debugging](https://code.visualstudio.com/docs/editor/debugging) in the Visual Studio Code docs.  
   As you step through your code during a debugging session, Apex Replay Debugger provides details about your variables from heap dumps on lines where you set checkpoints.
When you’ve stepped through all the logged events, the debugging session ends. If you want to start again at the beginning of the log, run **SFDX: Launch Apex Replay Debugger with Last Log File**.

## Considerations

Keep these considerations and known issues in mind when working with Apex Replay Debugger.

- Before you start using the debugger, make sure that the version of the `.cls` or `.trigger` file you used to generate the log that you're debugging, is the same as the file you're working with. Otherwise, not all breakpoints will be hit during debugging. 
- You can use this debugger only in your orgs. ISV customer debugging is unavailable in Apex Replay Debugger. To debug customers’ orgs, use [ISV Customer Debugger](./en/apex/isv-debugger).
- You can replay only one debug log at a time. This limitation can make it difficult to debug asynchronous Apex, which produces multiple debug logs.
- Be sure to start a debugging session soon after uploading your checkpoints, because checkpoints expire after 30 minutes.
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

## Resources
[Use the Apex Replay Debugger to Streamline Your Debugging Workflow](https://developer.salesforce.com/blogs/2022/04/use-the-apex-replay-debugger-to-streamline-your-debugging-workflow)
