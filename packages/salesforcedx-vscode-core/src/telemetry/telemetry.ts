import vscode = require('vscode');
import TelemetryReporter from 'vscode-extension-telemetry';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';

const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage13'; // TODO: this will change until dev process of the feature is done.

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

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (this.reporter === undefined && sfdxCoreSettings.getTelemetryEnabled()) {
      const extensionPackage = require(this.context.asAbsolutePath(
        './package.json'
      ));

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
      TELEMETRY_GLOBAL_VALUE
    );

    return typeof sfdxTelemetryState === 'undefined';
  }

  private setTelemetryMessageShowed() {
    if (this.context === undefined) {
      return;
    }

    this.context.globalState.update(TELEMETRY_GLOBAL_VALUE, true);
  }

  public showTelemetryMessage() {
    // check if we've ever shown Telemetry message to user
    const showTelemetryMessage = this.getTelemetryMessageShowed();

    if (showTelemetryMessage) {
      // this means we need to show the message and set telemetry to true;
      const readMoreBtn = 'Read More';
      vscode.window.showInformationMessage(
        nls.localize('telemetry_legal_dialog_message'),
        readMoreBtn
      );

      this.setTelemetryMessageShowed();
    }
  }

  public sendExtensionActivationEvent() {
    if (this.reporter !== undefined) {
      console.log('************** sendExtensionActivationEvent **************');
      this.reporter.sendTelemetryEvent('activationEvent');
    }
  }

  public sendExtensionDeactivationEvent() {
    if (this.reporter !== undefined) {
      console.log(
        '************** sendExtensionDeactivationEvent **************'
      );
      this.reporter.sendTelemetryEvent('deactivationEvent');
    }
  }

  public sendCommandEvent(commandName: string) {
    if (this.reporter !== undefined) {
      console.log(
        '************** sendCommandEvent ' + commandName + ' **************'
      );
      this.reporter.sendTelemetryEvent('commandExecution', { commandName });
    }
  }
}
