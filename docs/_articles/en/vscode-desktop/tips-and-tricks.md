---
title: Tips and Tricks
lang: en
---

## Organize Your VS Code Extensions by Development Task

> **NOTE**: Because Code Builder is a web-based, these tips are not of relevance if Code Builder is your development environment of choice.

Organizing your VS Code extensions by development task can help you avoid having extensions provide functionality that’s not useful for the task at hand. Having only the extensions that you need helps minimize the VS Code startup time and ensures that shortcut keys don’t interfere with one another. Here’s how to set up VS Code to launch with only the extensions for working with Salesforce.

1.  Add a `code-sfdx` alias to your shell’s startup script.

    - Windows

      1. When you install VS Code, install `code` as part of your prompt. See [Visual Studio Code on Windows](https://code.visualstudio.com/docs/setup/windows#_installation) in the Visual Studio Code docs for details.
      2. Open Git Bash. (Git Bash is installed as part of Salesforce CLI.)
      3. Check whether you have a `.bashrc` file. If you don’t, create it by running:  
         `touch .bashrc`
      4. Add this line to your `.bashrc` file.  
         `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

    - macOS or Linux

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
