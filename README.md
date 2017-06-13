# Salesforce Development Tools for Visual Studio Code

## Getting Started

1. Install Visual Studio Code from https://code.visualstudio.com
1. Clone this repository using `git clone git@git.soma.salesforce.com:DevTools/vscode-salesforcedx.git`.
1. Open the cloned repository in Visual Studio Code. This is the host instance.
1. Open the integrated terminal and execute `npm install` to bring in all the Node.js dependencies.
1. Hit Cmd + Shift + B to initialize the project builder. This will build all the files that you need in the `out` directory. It also watches for any changes you make to the file and automatically compiles them.
1. Hit F5 to launch another instance of Visual Studio Code. This is a special version of Visual Studio code with the extension loaded. You can debug your things in it.

## Including your own version of the Apex Language Server

1. For the Apex Language Server, you need to issue `git clonegit@git.soma.salesforce.com:DevTools/apex-jorje.git`.
1. In the directory where you clone the previous repository, switch to the `nick/apex-lsp` branch.
1. __This part is not as smoothly automated yet__ Run the script in `scripts/pre-jars.sh` (after modifications to point it to where you have the apex-jorje source checked out).
