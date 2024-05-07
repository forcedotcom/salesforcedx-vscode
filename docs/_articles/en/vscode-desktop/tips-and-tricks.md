---
title: Tips and Tricks
lang: en
---

## Organize Your VS Code Extensions by Development Task

> **NOTE**: Because Code Builder is a web-based, this tip isn’t of relevance if Code Builder is your development environment of choice.

Organizing your VS Code extensions by development task can help you avoid having extensions provide functionality that’s not useful for the task at hand. Having only the extensions that you need helps minimize the VS Code startup time and ensures that shortcut keys don’t interfere with one another. Here’s how to set up VS Code to launch with only the extensions for working with Salesforce.

1.  Add a `code-sfdx` alias to your shell’s startup script.

    - **Windows**

      1. When you install VS Code, install `code` as part of your prompt. See [Visual Studio Code on Windows](https://code.visualstudio.com/docs/setup/windows#_installation) in the Visual Studio Code docs for details.
      2. Open Git Bash. (Git Bash is installed as part of Salesforce CLI.)
      3. Check whether you have a `.bashrc` file. If you don’t, create it by running:  
         `touch .bashrc`
      4. Add this line to your `.bashrc` file.  
         `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

    - **macOS or Linux**

      1.  Open VS Code.
      2.  To open the Command Palette, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Linux).
      3.  Run the command **Shell command: Install 'code' command in PATH**.
          ![From the Command Palette, choose Shell command: Install 'code' command in PATH](./images/invoke_shell_command.png)

                This command lets you invoke `code` directly from your favorite terminal.

      4.  In your favorite terminal, open your shell’s startup script.

          If you’re using Bash, the startup script is typically your `.bashrc` or `.bash_profile` file. If you’re using Z Shell, it’s typically your `.zshrc` file. If you don’t have a file with these names, create a file called `.bashrc` in your home directory (for example, in `Macintosh HD/users/yourName`).

      5.  Add this line to your shell’s startup script.  
          `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

2.  Either open a new terminal window or run one of the following commands from your current terminal.  
    `source .bashrc`  
    `source .bash_profile`  
    `source .zshrc`

3.  From the terminal, run `code-sfdx` to launch an instance of VS Code that has only your extensions.

    > NOTE: The first time you launch `code-sfdx`, it has no extensions because it’s a fresh instance VS Code.

4.  Select **View** > **Extensions**.

5.  Install the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) extension (and any [other extensions](./en/getting-started/recommended-extensions) that you use for Salesforce development).

6.  The next time you’re working on a Salesforce DX project, you can launch VS Code using `code-sfdx` and all your extensions will be there.

You can have as many aliases as you want, with as many `extensions-dir` directories as you need to help organize your extensions.

## Create Keyboard Shortcuts for Common Tasks
If using keyboard shortcuts is your jam, you'll appreciate the rich keyboard shortcut editing experience with the Keyboard Shortcuts editor that VS Code provides. Open the editor from **Code > Settings > Keyboard Shortcuts** or from **Preferences: Open Keyboard Shortcuts** command (⌘K ⌘S). See [Key Bindings for Visual Studio Code](https://code.visualstudio.com/docs/getstarted/keybindings) for details.

## Use Quick Open  
Quickly search and open files. using the keyboard shortcut ⌘P.

## Commands for Salesforce Development
Open the Command Palette using the keyboard shortcut ⌘⇧P. Type "SFDX" to view a list of commands available in your Salesforce project.

## Use the Extensions View 
Bring up the Extensions view by clicking the Extensions icon in the Activity Bar on the side of VS Code or run the **View: Extensions** command (⇧⌘X). Search for an extension. On an extension's details page can look up a lot of information such as it's dependencies, feature details, settings, and change log.  

## Some Useful Commands

**Show Running Extensions**
Open the Command Palette and type "show running..." and find and run the **Developer:Show Running Extensions** command to view all the extensions currently running in your VS Code session. You can see the start-up time for each extension. Right click an extension and select **Report Issue** to quickly create an issue on the extension's GitHub repository. 
**Toogle Developer Tools**
Run **Developer:Toggle Tools** to view and understand the underpinnings of your VS Code sessions. From here you can grab any error messages that you'd like to include in an issue or a communication. 

