---
title: Local Development (Beta)
lang: jp
---

## Local Development Documentation in the Lightning Web Components Developer Guide

The Local Development Server is a Salesforce CLI plug-in that configures and runs a Lightning Web Components-enabled server on your computer. You can develop Lightning web components and see live changes without publishing the components to an org. See the full documentation in the [Lightning Web Components Developer Guide](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev).

## Run Local Development SFDX Commands in VS Code

The local development server uses the following SFDX commands.

View the local development server's SFDX commands from VS Code's command palette by pressing `command` + `shift` + `p`. By typing in "local development," all three commands are visible.

![VS Code Commands](./images/vscode_localdev_sfdx_commands.png)

**SFDX: Open Local Development Server**  
If the local development server isn't currently running, this command starts the server and opens localhost:333 in your web browser. If the server is already running, then the command only opens localhost:3333 in your browser.

**SFDX: Start Local Development Server**  
This command starts the local development server. If you already started the server from VS Code, then VS Code gives the option to open it in the browser or restart it. If you already started the server from the command line, then VS code shows an error in the output console.

**SFDX: Stop Local Development Server**  
This command stops the local development server.

**Preview Lightning Web Components in VS Code**  
To preview Lightning web components, right-click any line of code in the component's HTML, CSS, or JavaScript files. You can also right-click any of the HTML, CSS, or JavaScript filenames or the component folder. 

Preview `c-hello` from the HTML code.
![Preview component from HTML.](./images/vscode_localdev_preview_html.png)

Preview `c-hello` from the HTML file.
![Preview component from file.](./images/vscode_localdev_file_preview.png)

Here's the previewed component on the local development server.
![Previewed component in local development.](./images/vscode_localdev_preview.png)
