---
title: Local Development (Beta)
lang: en
---

The Local Development Server is a Salesforce CLI plug-in that configures and runs a Lightning Web Components-enabled server on your computer. You can develop Lightning web components and see live changes without publishing the components to an org.

**Note**: This plugin does not support the following features:

- `@AuraEnabled` Apex methods
- `CSS` custom properties
- `LightningModal`
- `lwc:if`, `lwc:elseif`, and `lwc:else` directives
- multiple directories and `sfdx` multiple packages

## Run Local Development Salesforce CLI Commands in VS Code

The Local Development server uses the following Salesforce CLI commands.

View the commands from VS Code's Command Palette by pressing `command` + `shift` + `p`. If you type "local development," all three commands are visible.

![VS Code commands for Local Development](./images/vscode_localdev_sfdx_commands.png)

**SFDX: Open Local Development Home**  
If the Local Development server isn't currently running, this command starts the server and opens `localhost:3333` in your web browser. If the server is already running, then the command only opens `localhost:3333` in your browser.

**SFDX: Start LWC Local Development Server**  
This command starts the Local Development server. If you already started the server from VS Code, then VS Code gives the option to open it in the browser or restart it. If you already started the server from the command line, then VS code shows an error in the output console.

> **Troubleshooting Tip:** If you see an error where the server can't start, it's possible that the port is already in use or a process is still running. If using VS Code, you can kill the process on the server port, by default, `3333`. If running the CLI in a terminal window, close the terminal and terminate any running processes.

**SFDX: Stop LWC Local Development Server**  
This command stops the Local Development server.

**Preview Lightning Web Components in VS Code**  
To preview Lightning web components, right-click any line of code in the component's HTML, CSS, or JavaScript files. You can also right-click any of the HTML, CSS, or JavaScript filenames or the component folder.

Preview `c-hello` from the HTML code.
![Preview component from HTML.](./images/vscode_localdev_preview_html.png)

Preview `c-hello` from the HTML file.
![Preview component from file.](./images/vscode_localdev_file_preview.png)

After you select SFDX: Preview Component Locally, the Command Palette displays a list of preview options. You can choose to preview your component in the desktop browser or in a virtual mobile device (iOS or Android). Mobile previews require additional setup. See ["Set Up Your Dev Environment" in the Lightning Web Components Dev Guide.](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.install_setup_develop)
![Choose to preview in the desktop browser, an Android emulator, or an iOS simulator.](./images/vscode_localdev_command_palette_preview_options.png)

Here’s the previewed component on the local development server’s desktop browser.
![Previewed component in a browser.](./images/vscode_localdev_preview.png)

Here's the previewed component on a virtual mobile device.
![Previewed component in a virtual mobile device.](./images/vscode_localdev_preview_ios.png)
