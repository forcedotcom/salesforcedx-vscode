# salesforcedx-vscode-visualforce
This extension uses the Visualforce Language Server and VS Code’s default HTML language server to provide syntax highlighting, code completion, and an outline view of your files.

For best results, use this extension with the other extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) bundle.  

##  Prerequisites
Before you set up this extension, make sure that you have [Visual Studio Code](https://code.visualstudio.com/download) v1.17 or later.  

## Features Provided by This Extension
* Code completion (invoke using Ctrl+Space)
   * Standard Visualforce components (tags and attributes), with Salesforce documentation
   * HTML tags
   * CSS
   * JavaScript  
   
   ![Code-completion options and associated documentation in a .page file](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-visualforce/images/visualforce_completion.png)

* Syntax highlighting in some sections of various files (`.page`, `.component`, `.app`, and so on)
   * HTML portions
   * Embedded CSS and JavaScript portions  
   
   ![Colored syntax highlighting in a .page file](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-visualforce/images/visualforce_syntax.png)

* Outline view (invoke using Cmd+Shift+O on macOS, or Ctrl+Shift+O on Windows and Linux)

   ![List of symbols in a .page file](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-visualforce/images/visualforce_outline.png)

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* _[Visualforce Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages)_
* GitHub: [Language Server Protocol](https://github.com/Microsoft/language-server-protocol)
* GitHub: [salesforcedx-vscode-visualforce](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-visualforce)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.   

---