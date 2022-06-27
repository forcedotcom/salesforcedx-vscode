import * as vscode from 'vscode';
import { SfdxCoreSettings } from '../../../salesforcedx-vscode-core/out/src/settings/sfdxCoreSettings';

const coreExtensionName = 'salesforce.salesforcedx-vscode-core';
let coreExtension: vscode.Extension<any> | undefined;

export function getSfdxSettingsService(): SfdxCoreSettings {
  if (!coreExtension) coreExtension = vscode.extensions.getExtension(coreExtensionName);
  if (coreExtension) {
    return coreExtension.exports.sfdxCoreSettings;
  } else {
    // Send telemetry here.  Core extension not loaded.
    throw new Error(`${coreExtensionName} not loaded`);
  }
}
