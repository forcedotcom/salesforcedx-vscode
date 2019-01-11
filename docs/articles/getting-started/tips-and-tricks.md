---
title: Tips and Tricks
---

## Organize Your VS Code Extensions by Development Task

Organizing your VS Code extensions by development task helps avoid having extensions providing functionality that’s not useful for the task at hand. Having only the extensions that you need helps minimize the VS Code startup time and ensures that shortcut keys don’t interfere with one another. Here’s how to set up VS Code to launch with only the extensions for working with Salesforce DX.

1.  Add a `code-sfdx` alias to your shell’s startup script.

    - macOS and Linux

      1.  Open VS Code.
      1.  To invoke the command palette, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Linux).
      1.  Run the command **Shell command: Install 'code' command in PATH**.
          ![From the command palette, choose Shell command: Install 'code' command in PATH](https://github.com/forcedotcom/salesforcedx-vscode/wiki/images/invoke_shell_command.png)

                This command lets you invoke `code` directly from your favorite terminal.

      1.  In your favorite terminal, open your shell’s startup script.

          If you’re using Bash, the startup script is typically your `.bashrc` or `.bash_profile` file. If you’re using Z Shell, it’s typically your `.zshrc` file. If you don’t have a file with these names, create a file called `.bashrc` in your home directory (for example, in `Macintosh HD/users/yourName`).

      1.  Add this line to your shell’s startup script.  
          `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

    - Windows
      1. When you install VS Code, install `code` as part of your prompt. See [https://code.visualstudio.com/docs/setup/windows#\_installation](https://code.visualstudio.com/docs/setup/windows#_installation) for details.
      1. Open Git Bash. (Git Bash is installed as part of the Salesforce CLI.)
      1. Check whether you have a .bashrc file. If you don’t, create it by running:  
         `touch .bashrc`
      1. Add this line to your .bashrc file.  
         `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

1.  Either open a new terminal window or run one of the following commands from your current terminal.  
    `source .bashrc`  
    `source .bash_profile`  
    `source .zshrc`
1.  From the terminal, run `code-sfdx` to launch an instance of VS Code that only has your extensions.

    **NOTE**: The first time you launch `code-sfdx`, it has no extensions! That is expected because this is a fresh instance VS Code.

1.  Select **View** > **Extensions**.
1.  Install the extensions for Salesforce DX:
    - [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core)
    - [salesforcedx-vscode-apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex)
    - [salesforcedx-vscode-lightning](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lightning)
    - [salesforcedx-vscode-visualforce](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-visualforce)
1.  The next time you’re working on a Salesforce DX project, you can launch VS Code using `code-sfdx` and all your extensions will be there.

You can have as many aliases as you want, with as many `extensions-dir` directories as you need to help organize your extensions.
