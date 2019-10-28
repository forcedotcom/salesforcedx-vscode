import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';
import { nls } from '../messages';

// TODO better way to import?
const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  getDefaultUsernameOrAlias,
  getUserId,
  isCLIInstalled,
  notificationService,
  OrgAuthInfo,
  ProgressNotification,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  sfdxCoreSettings,
  SfdxWorkspaceChecker,
  taskViewService,
  telemetryService,
  CompositePreconditionChecker
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export class ForceLightningLwcStartExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_lwc_start_text'))
      .withArg('force:lightning:lwc:start')
      .withLogName('force_lightning_lwc_start')
      .withJson()
      .build();
  }
}

const preconditionChecker = new CompositePreconditionChecker(
  new SfdxWorkspaceChecker()
  // TODO serverRunningChecker()
);

const parameterGatherer = new EmptyParametersGatherer();

export default async function command() {
  const commandlet = new SfdxCommandlet(
    preconditionChecker,
    parameterGatherer,
    new ForceLightningLwcStartExecutor()
  );
  await commandlet.run();
}
