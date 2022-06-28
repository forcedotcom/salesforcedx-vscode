import * as vscode from 'vscode';

// This is not exported as a type from salesforcedx-vscode-core
// Just a quick hack to make typescript happy until we get this type definition exported correctly.
export declare type LocalSfdxCoreSettings = {
  getEnableClearOutputBeforeEachCommand(): boolean;
};

const coreExtensionName = 'salesforce.salesforcedx-vscode-core';
let coreExtension: vscode.Extension<any> | undefined;

export function getSfdxSettingsFromCoreExtension(): LocalSfdxCoreSettings | undefined {
  if (!coreExtension) coreExtension = vscode.extensions.getExtension(coreExtensionName);
  if (coreExtension) {
    return coreExtension.exports.sfdxCoreSettings;
  } else {
    // Send telemetry here.  Core extension not loaded.
    return undefined;
  }
}
