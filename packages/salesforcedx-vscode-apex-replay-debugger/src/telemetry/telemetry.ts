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

  public initializeService(
    context: vscode.ExtensionContext,
    isTelemetryEnabled: boolean
  ): TelemetryReporter | undefined {
    this.context = context;

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (this.reporter === undefined && isTelemetryEnabled) {
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

  public sendExtensionActivationEvent(): void {
    if (this.reporter !== undefined) {
      this.reporter.sendTelemetryEvent('activationEvent');
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined) {
      this.reporter.sendTelemetryEvent('deactivationEvent');
    }
  }

  public sendCommandEvent(commandName: string): void {
    if (this.reporter !== undefined) {
      this.reporter.sendTelemetryEvent('commandExecution', { commandName });
    }
  }
}
