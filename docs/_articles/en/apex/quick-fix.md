---
title: Apex Quick Fix
lang: en
---

The Quick Fix widget suggests ways to automatically update your code.

## Quick Fix: Declare Missing Methods

You can invoke the Quick Fix widget when you reference a method that isn’t declared in your source. The widget declares the method for you automatically.

There are three ways to invoke the Declare Missing Methods quick fix in VS Code.

1. When you click the name of the undeclared method, a lightbulb appears on the left side of the editor window. Click the lightbulb, then click **Create method '_yourMethod_' in '_YourClass_'** to make the quick fix.

![GIF showing declare missing methods quick fix invocation via lightbulb](./images/declare-missing-methods-1.gif)

2. Hover over the method name, then click **Quick Fix** in the window that pops up. Then, click **Create method '_yourMethod_' in '_YourClass_'** to make the quick fix.

![GIF showing declare missing methods quick fix invocation via window popup](./images/declare-missing-methods-2.gif)

3. The keyboard shortcut for the Quick Fix widget is Ctrl+. (Windows or Linux) or Cmd+. (macOS).
