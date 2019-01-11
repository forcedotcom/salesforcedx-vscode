---
title: Aura Framework
---

## Features Provided by This Extension

- Syntax highlighting in some sections of various files (`.page`, `.component`, `.app`, and so on)

  - HTML portions
  - Embedded CSS and JavaScript portions

  ![Colored syntax highlighting in a .js file from a Lightning bundle](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_syntax.png)

- Code completion (invoke using Ctrl+Space)

  - HTML tags
  - CSS
  - JavaScript

  ![Code-completion options in a .js file from a Lightning bundle](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_completion.png)

- Outline view (invoke using Cmd+Shift+O on macOS, or Ctrl+Shift+O on Windows and Linux)

  ![List of symbols in a .js file from a Lightning bundle](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_outline.png)

- Salesforce Lightning Design System Linter

  - Detects deprecated BEM syntax (`--`) for Salesforce Lightning Design System class names in HTML files
  - Warning message displays on hover
  - Code actions are available on click
    Note: The linter won't run if SLDS is included as a static resource in your project.

  ![SLDS Linter detecting deprecated '--' class name syntax](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-lightning/images/lightning_slds.png)
