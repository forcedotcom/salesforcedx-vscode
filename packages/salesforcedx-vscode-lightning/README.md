# salesforcedx-vscode-lightning
This extension uses the default HTML language server from VS Code to provide syntax highlighting, code completion, an outline view of your files, and a Salesforce Lightning Design System (SLDS) linter.

For best results, use this extension with the other extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) bundle.  

## Features Provided by This Extension
* Syntax highlighting in some sections of various files (`.page`, `.component`, `.app`, and so on)
   * HTML portions
   * Embedded CSS and JavaScript portions  

   ![Colored syntax highlighting in a .js file from a Lightning bundle](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_syntax.png)

* Code completion (invoke using Ctrl+Space)
   * HTML tags
   * CSS
   * JavaScript  

   ![Code-completion options in a .js file from a Lightning bundle](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_completion.png)

* Outline view (invoke using Cmd+Shift+O on macOS, or Ctrl+Shift+O on Windows and Linux)

   ![List of symbols in a .js file from a Lightning bundle](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_outline.png)

* Salesforce Lightning Design System Linter
   * Detects deprecated BEM syntax (`--`) for Salesforce Lightning Design System class names in HTML files
   * Warning message displays on hover
   * Code actions are available on click
   Note: The linter won't run if SLDS is included as a static resource in your project.

   ![SLDS Linter detecting deprecated '--' class name syntax](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_slds.png)

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* _[Lightning Components Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning)_
* GitHub: [salesforcedx-vscode-lightning](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-lightning)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.    

---