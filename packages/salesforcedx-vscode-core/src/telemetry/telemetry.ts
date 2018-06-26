import { ExtensionContext } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

// TODO: add something to pop up a metric message
// https://code.visualstudio.com/docs/extensionAPI/vscode-api#_extensions
export function createReporter(context: ExtensionContext) {
  const extensionPackage = require(context.asAbsolutePath('./package.json'));
  console.log('---------------------------------------');
  console.log('createReporter, getting extension info');
  console.log('---------------------------------------');
  const reporter = new TelemetryReporter(
    extensionPackage.name,
    extensionPackage.version,
    extensionPackage.aiKey
  );
  context.subscriptions.push(reporter);
  return reporter;
}
