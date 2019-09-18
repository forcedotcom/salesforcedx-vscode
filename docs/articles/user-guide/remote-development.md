---
title: Remote Development - Containers
---

## Overview

Salesforce Extension for VS Code supports remote development and allows you to use a container as a full-featured development environment. You can open a project mounted into the container and edit with full code completions, code navigation, debugging, and more.

> NOTICE: The remote development feature is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](../bugs-and-feedback).

Refer to VS Code documentation if you want to understand more about remote development:

- Use a [Docker container](https://www.docker.com/) as your [development container](https://code.visualstudio.com/docs/remote/containers#_indepth-setting-up-a-folder-to-run-in-a-container)
- Provide [full-featured development environment](https://code.visualstudio.com/docs/remote/remote-overview)
- Switch your development environment by [connecting to a container](https://code.visualstudio.com/docs/remote/containers)

## Install

To start remote development in dev container, install:

- Docker Desktop. For system requirements and installation instructions, see:
  - [Windows](https://docs.docker.com/docker-for-windows/install/): Currently Docker desktop for windows supports only Linux Containers and [not Windows Containers](https://code.visualstudio.com/docs/remote/containers#_known-limitations). During the install process, ensure you use the default option of Linux Containers.
  - [Mac](https://docs.docker.com/docker-for-mac/install/)
  - [Linux](https://docs.docker.com/install/linux/docker-ce/centos/)
- Latest version of [VS Code](https://code.visualstudio.com/download)
- Latest version of [VS Code Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack).
  After you install VS Code and Docker Desktop for your operating system:
  - For Windows, set source code locations you want to open in a container. In Docker, right-click and select **Settings** / **Preferences** > **Shared Drives** / **File Sharing**. See [Container tips](https://code.visualstudio.com/docs/remote/troubleshooting#_container-tips) if you hit trouble with sharing.
  - For Linux, see [supported platforms](https://docs.docker.com/install/#supported-platforms). From the terminal, run `sudo usermod -aG docker $USER` to add your user to the `docker` group. This setting takes effect after you sign out and back in again.
- Latest version of the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)

## Try a Dev Container with a Sample Project

Let’s use a sample project we provide and try remote development in Docker container with Salesforce Extension.

1. Clone the [sample repository](https://github.com/forcedotcom/vscode-remote-try-sfdx). The `.devcontainer` folder in the sample project contains the `devcontainer.json` file that defines how to configure the dev container, the Dockerfile to use, and the extensions to install. For details, see [Creating a devcontainer.json file](https://code.visualstudio.com/docs/remote/containers#_creating-a-devcontainerjson-file) and [devcontainer.json reference](https://code.visualstudio.com/docs/remote/containers#_devcontainerjson-reference).
1. Run `Remote-Containers: Open Folder in Container` from the Command Palette and open the project you cloned. VS code creates a dev container the first time you open the project. After the dev container is built, the project folder in your local system automatically connects and maps into the container, and the side bar shows **Dev Container: Salesforce Project**. The container will pre-install and configure Java, Git, Salesforce CLI, and all other extensions defined in the `devcontainer.json` file.

   ![Dev Coontainer](../../images/devcontainer.png)

1. From the Command Palette, run the `SFDX:Authorize a Dev Hub` in the container. From the Output panel (below the editor region), you can get the user code and the verification URL required to complete the authorization.
   If you are logged in to an org that you don’t want to authorize as a Dev Hub, make sure you log out. Otherwise you’ll not be prompted to enter the credentials for the org you want to authorize.
   After the authorization is complete, the message `SFDX: Authorize a Dev Hub successfully ran` is displayed. In case the success message is not displayed, check if you have the correct user code and try again. If the login page doesn’t prompt you to re-enter the code, terminate the command and run it again.
   If you are interested, read more about [Device Authentication Flow](https://help.salesforce.com/articleView?id=remoteaccess_oauth_device_flow.htm&type=5).
   ![Authorize Success Message](../../images/authorize_message.png)
1. Run `SFDX: Create a Default Scratch Org`.

   You’re all set to use the container as a full-featured development environment.

## Open a Project in a Dev Container

1. Open an existing project you want to work with or create a new project.
1. From the Command Palette, run `Remote-Container: Add Development Container Configuration Files`.
   If you are unable to see this command, make sure that you have installed the latest version of VS Code Remote Development Extension Pack.
   ![Add Dev Container Config Files](../../images/add_dev_container.png)
1. Select **Salesforce Project** from the list of templates to add `SFDX .devcontainer` folder. VS Code detects the dev container configuration file and prompts you to reopen the project folder in a container.
1. Click `Reopen in Container` to build a dev container. Now the side bar shows **Dev Container: Salesforce Project**.

   You’ve set up a dev container for an existing project to use as your full-time development environment.

See Also (VS Code documentation):

- [Opening a Terminal in a Container](https://code.visualstudio.com/docs/remote/containers#_opening-a-terminal)
- [Debugging in a Container](https://code.visualstudio.com/docs/remote/containers#_debugging-in-a-container)
- [Container Specific Settings](https://code.visualstudio.com/docs/remote/containers#_container-specific-settings)
- [Known Limitations](https://code.visualstudio.com/docs/remote/containers#_known-limitations)
- [Common Questions](https://code.visualstudio.com/docs/remote/containers#_common-questions)
