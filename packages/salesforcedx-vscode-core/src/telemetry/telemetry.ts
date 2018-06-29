import vscode = require('vscode');
import TelemetryReporter from 'vscode-extension-telemetry';

export class TelemetryService {
  private static instance: TelemetryService;
  private context: vscode.ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(context: vscode.ExtensionContext) {
    this.context = context;

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

  private getTelemetryMessageShowed() {
    if (this.context === undefined) {
      return null;
    }

    const sfdxTelemetryState = this.context.globalState.get(
      'sfdxTelemetryMessage11'
    );

    return typeof sfdxTelemetryState === 'undefined';
  }

  private setTelemetryMessageShowed() {
    if (this.context === undefined) {
      return null;
    }

    // Make sure this is in sync with getTelemetryMessageShowed
    this.context.globalState.update('sfdxTelemetryMessage', true);
  }

  public showTelemetryMessage() {
    // check if we've ever shown Telemetry message to user ?
    const showTelemetryMessage = this.getTelemetryMessageShowed();
    console.log('---------------------------------------');
    console.log('showTelemetryMessage function, ', showTelemetryMessage);
    console.log('---------------------------------------');

    if (showTelemetryMessage) {
      // this means we need to show the message and set telemetry to true;
      const optOutBtn = 'Opt Out Button';
      vscode.window.showInformationMessage(
        'This is the error message triggered from telemetryService :)',
        optOutBtn
      );

      this.setTelemetryMessageShowed();
    }
  }

  // TODO: check for telemetry enabled setting (TBD)
  public sendExtensionActivationEvent() {
    if (this.reporter !== undefined) {
      this.reporter.sendTelemetryEvent('activationEvent');
    }
  }

  // TODO: check for telemetry enabled setting (TBD)
  public sendCommandEvent(commandName: string) {
    if (this.reporter !== undefined) {
      this.reporter.sendTelemetryEvent('commandExecution', { commandName });
    }
  }
}
