# Local Development (Beta)

The Local Development server is an SFDX CLI plugin that configures and runs a Lightning Web Components-enabled server on your computer. Now you can develop Lightning Web Component modules and see live changes without publishing your components to an org.

**Note**: This feature is in beta and has been released early so we can collect your feedback. It may contain significant problems, undergo major changes, or be discontinued. If you encounter any problems, or want to request an enhancement, open a [GitHub issue](https://github.com/forcedotcom/lwc-dev-server/issues/new). The use of this feature is governed by the [Salesforce.com Program Agreement](https://trailblazer.me/terms?lan=en).

# Setup

## System Requirements
- Developer Hub-enabled org
- Most recent stable version of Safari, Chrome, Firefox, or Edge web browser 
- Windows—Windows 7 (64-bit and 32-bit) or later
- Mac—macOS 10.11 or later
- Linux—Ubuntu 14.0.4 or later
- Salesforce CLI

To develop Lightning web components, use your favorite code editor. We recommend using Visual Studio Code because its [Salesforce Extensions for VS Code](https://developer.salesforce.com/tools/extension_vscode) provide powerful features for development on Lightning Platform.

## Installation

1. Open a new terminal window and run the following command to install the Local Development Server. 

```sh
sfdx plugins:install lwc-dev-server
```

2. Check for updates to the Local Development Server.

```sh
sfdx plugins:update
```

3. Navigate to your SFDX project, or clone one that has Lightning web components. In this example, we are using `lwc-recipes`.

```sh
git clone git@github.com:trailheadapps/lwc-recipes.git
```
4. If you're not in the project's root directory already, `cd` into it. The root of the directory has the file `package.json` in it. 

```sh
cd lwc-recipes
```

5. Add the `.localdevserver` folder in your SFDX project to your `.gitignore` file. Do not modify files inside of this folder.

6. Authorize a Developer Hub (Dev Hub) by following the steps in [Enable Dev Hub In Your Org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_enable_devhub.htm) in the *Salesforce DX Developer Guide*. A Dev Hub is the main Salesforce org that you and your team use to create and manage your scratch orgs, temporary environments for developing on the Salesforce platform. You need the Dev Hub to create a scratch org in a later step.

7. Following the instructions in the *Salesforce DX Developer Guide*, log in using your Dev Hub credentials. Running the following command spawns a login window in your browser.

```sh
sfdx force:auth:web:login -d -a <myhuborg>
```

8. In local development, requests to Lightning Data Service and Apex go to scratch orgs, similar to how they go to your production org. To create a scratch org, run this command from the command line.

```sh
sfdx force:org:create -s -f config/project-scratch-def.json -a "LWC"
```

“LWC” is an alias for the scratch org that you can use in other Salesforce CLI commands.

To create a scratch org, specify a scratch org definition file. This example uses the scratch org definition file, project-scratch-def.json that is included in `lwc-recipes`. For other projects, create your own. For more information, see the instructions for [Create Scratch Orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_create.htm) in the *Salesforce DX Developer Guide*.

9. Start the server.

```sh
sfdx force:lightning:lwc:start
```

For more information on this command, view Help for the Local Development Server by running `sfdx force:lightning:lwc:start --help`.

10. View the server at [http://localhost:3333/](http://localhost:3333/). 

## Troubleshooting

```sh-session
$ sfdx force:lightning:lwc:start
(node:78804) [ENOENT] Error: spawn lwc-dev-server ENOENT
ERROR running force:lightning:lwc:start:  Must pass a username and/or OAuth options when creating an AuthInfo instance.
```

If you see this error, make sure that you authenticate to your Dev Hub and create a scratch org. 

## Configuration for Projects (Optional)

SFDX automatically configures your project out of the box, but if you want to provide additional information for the server, add a localdevserver.config.json file at the base of your project. 

Here's an example that shows the available configuration parameters.

```json5
{
    // What namespace to use referencing your Lightning Web Components
    "namespace": "c",

    // Name of the component to load in the default container
    "main": "app", 

    // Where are your component files. If you have a namespace, specify the directory the namespace folder is in.
    "modulesSourceDirectory": "src/", 

    // Where are your static assets.
    "staticResourcesDirectory": "",

    // The address port for your local server. Defaults to 3333
    "port": 3333,

    // Optional path to the custom labels file
    "customLabelsFile": "labels/CustomLabels.labels-meta.xml",
}
```
