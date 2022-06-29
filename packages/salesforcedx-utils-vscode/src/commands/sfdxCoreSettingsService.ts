import * as vscode from 'vscode';

// define the simple type rather than declare a dev dependency on salesforcedx-vscode-core
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
