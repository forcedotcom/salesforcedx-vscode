## 40.5.0 - August 10, 2017

### Bug Fixes
    
#### salesforcedx-vscode-apex

* Fixed the way entries are stored in the database to prevent errors when upgrading to the latest version of the extension.

#### salesforcedx-vscode-core

* The SFDX: Create a Default Scratch Org command now looks for `*-scratch-def.json` files only in the `config` directory and its children.
* SFDX commands appear in the command palette only when a directory open in a VS Code window contains an `sfdx-project.json` file.
