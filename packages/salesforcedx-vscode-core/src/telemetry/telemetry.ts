import vscode = require('vscode');
import TelemetryReporter from 'vscode-extension-telemetry';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';

const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage14'; // TODO: this will change until dev process of the feature is done.

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

  public initializeService(
    context: vscode.ExtensionContext
  ): TelemetryReporter | undefined {
    this.context = context;

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (this.reporter === undefined && this.isTelemetryEnabled()) {
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

  public isTelemetryEnabled(): boolean {
    return sfdxCoreSettings.getTelemetryEnabled();
  }

  private getHasTelemetryMessageBeenShown(): boolean {
    if (this.context === undefined) {
      return true;
    }

    const sfdxTelemetryState = this.context.globalState.get(
      TELEMETRY_GLOBAL_VALUE
    );

    return typeof sfdxTelemetryState === 'undefined';
  }

  private setTelemetryMessageShowed(): void {
    if (this.context === undefined) {
      return;
    }

    this.context.globalState.update(TELEMETRY_GLOBAL_VALUE, true);
  }

  public showTelemetryMessage(): void {
    // check if we've ever shown Telemetry message to user
    const showTelemetryMessage = this.getHasTelemetryMessageBeenShown();

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

  public sendExtensionActivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('activationEvent');
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('deactivationEvent');
    }
  }

  public sendCommandEvent(commandName: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('commandExecution', { commandName });
    }
  }
}
