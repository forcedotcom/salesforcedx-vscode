# Undeclared Configurations

Certain configurations within the VS Code settings are intentionally not declared,
aiming to maintain user transparency. However, they are documented here for the benefit of those
who might wish to utilize them. These settings can be customized in the settings.json file.
To access this file, use the Command Palette by typing "Preferences: Open User Settings (JSON)."

## Configuration Details

- `'salesforcedx-vscode-apex.wait-init-jobs'`: This setting prevents requests from being sent to the Apex Language Server until the initialization process is complete. Default is true.
