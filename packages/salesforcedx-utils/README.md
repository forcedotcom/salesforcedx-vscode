# `salesforcedx-utils`

This is a internal module to the VSCode Extensions for Salesforce that is used for
sharing functionality across the VSCode Salesforce Extension code base when there
is not a dependancy on the vscode module. This is necessary due to needing the abilty
to test our code that doesn't use the vscode module without having to worry about it
not existing outside of the VSCode runtime.
