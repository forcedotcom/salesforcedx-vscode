---
title: Project Explorer
lang: ja
---

At the heart of Salesforce development is the Salesforce DX project. The project structure contains a default package directory, **force-app**:

```text
your-app
├── README.md
├── sfdx-project.json
├── .sfdx
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── force-app
|   └── main
|       └── default
|           ├── aura
|           ├── classes
|           └── objects
└── manifest
    └── package.xml
```

See [Salesforce DX Project Structure and Source Format](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm) to learn about folders in the project.

Some standard files you’ll see in your project that are prepopulated for you are:

- **.gitignore**: Makes it easier to start using Git for version control.
- **.prettierrc** and **.prettierignore**: Make it easier to start using Prettier to format your Aura components.
- **.vscode/extensions.json** and **.vscode/launch.json**: Configure Replay Debugger, making it more discoverable and easier to use.
- **.vscode/settings.json**: By default, this file has one setting, for push or deploy on save, which is set to false. You can change this value or add other settings.
