---
title: Code Preview (Generally Available)
lang: en
---

The Code Preview Server is a Salesforce CLI plug-in that configures and runs a Lightning Web Components-enabled server on your computer. You can develop Lightning web components and see live changes without publishing the components to an org. 

## Run Code Preview Salesforce CLI Commands in VS Code

The Code Preview server uses the following Salesforce CLI commands.

View the commands from VS Code's command palette by pressing `command` + `shift` + `p`. By typing in "code preview," all three commands are visible.

![VS Code commands for Code Preview](./images/vscode_codepreview_commands.png)

**SFDX: Open Code Preview Home**  
If the Code Preview server isn't currently running, this command starts the server and opens `localhost:3333` in your web browser. If the server is already running, then the command only opens `localhost:3333` in your browser.

**SFDX: Start LWC Code Preview Server**  
This command starts the Code Preview server. If you already started the server from VS Code, then VS Code gives the option to open it in the browser or restart it. If you already started the server from the command line, then VS code shows an error in the output console.

> **Troubleshooting Tip:** If you see an error where the server can't start, it's possible that the port is already in use or a process is still running. If using VS Code, you can kill the process on the server port, by default, `3333`. If running the CLI in a terminal window, close the terminal and terminate any running processes.

**SFDX: Stop LWC Code Preview Server**  
This command stops the Code Preview server.

**Preview Lightning Web Components in VS Code**  
To preview Lightning web components, right-click any line of code in the component's HTML, CSS, or JavaScript files. You can also right-click any of the HTML, CSS, or JavaScript filenames or the component folder. 

Preview `c-hello` from the HTML code.
![Preview component from HTML.](./images/vscode_preview_component_code.png)

Preview `c-hello` from the HTML file.
![Preview component from file.](./images/vscode_codepreview_file_preview.png)

After you select SFDX: Preview Component Locally, the Command Palette displays a list of preview options. You can choose to preview your component in the desktop browser or in a virtual mobile device (iOS or Android). Mobile previews require additional setup. See ["Set Up Your Dev Environment" in the Lightning Web Components Dev Guide.](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.install_setup_develop)
![Choose to preview in the desktop browser, an Android emulator, or an iOS simulator.](./images/vscode_codepreview_mobile_options.png)

Here’s the previewed component on the local development server’s desktop browser.
![Previewed component in a browser.](./images/vscode_codepreview.png)

Here's the previewed component on a virtual mobile device.
![Previewed component in a virtual mobile device.](./images/vscode_codepreview_ios.png)
