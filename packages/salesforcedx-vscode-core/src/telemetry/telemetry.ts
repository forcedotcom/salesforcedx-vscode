import vscode = require('vscode');
import TelemetryReporter from 'vscode-extension-telemetry';

export class TelemetryService {
  private static instance: TelemetryService;
  private context: vscode.ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;

  public static getInstance(context?: vscode.ExtensionContext) {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public setContext(context: vscode.ExtensionContext) {
    this.context = context;
  }
  // TODO: add something to pop up a metric message
  // https://code.visualstudio.com/docs/extensionAPI/vscode-api#_extensions
  public getReporter() {
    if (this.context === undefined) {
      return null;
    }

    if (this.reporter === undefined) {
      const extensionPackage = require(this.context.asAbsolutePath(
        './package.json'
      ));
      console.log('---------------------------------------');
      console.log('createReporter, getting extension info');
      console.log('---------------------------------------');
      this.reporter = new TelemetryReporter(
        extensionPackage.name,
        extensionPackage.version,
        extensionPackage.aiKey
      );
      this.context.subscriptions.push(this.reporter);
    }

    return this.reporter;
  }

  public getTelemetryMessageShowed() {
    if (this.context === undefined) {
      return null;
    }

    const sfdxTelemetryState = this.context.globalState.get(
      'sfdxTelemetryMessage'
    );
    console.log('---------------------------------------');
    console.log('sfdxTelemetryState', sfdxTelemetryState);
    console.log('---------------------------------------');

    return typeof sfdxTelemetryState === 'undefined';
  }

  public setTelemetryMessageShowed() {
    if (this.context === undefined) {
      return null;
    }

    const sfdxTelemetryState = this.context.globalState.update(
      'sfdxTelemetryMessage',
      true
    );
    console.log('---------------------------------------');
    console.log('setTelemetryMessageShowed, ', sfdxTelemetryState);
    console.log('---------------------------------------');

    // return sfdxTelemetryState === 'undefined';
  }
}
