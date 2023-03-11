import {
  getRelativeProjectPath,
  getRootWorkspacePath,
  Row,
  SourceTrackingService,
  Table
} from '@salesforce/salesforcedx-utils-vscode/src';
import {
  ComponentSet,
  ComponentStatus,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { PersistentStorageService } from '../conflict';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { SfdxPackageDirectories } from '../sfdxProject';
import { DeployRetrieveExecutor } from './deployRetrieveExecutor';

export abstract class RetrieveExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    const projectPath = getRootWorkspacePath();
    const connection = await WorkspaceContext.getInstance().getConnection();
    const sourceTracking = await SourceTrackingService.createSourceTracking(
      projectPath,
      connection
    );

    const defaultOutput = join(
      projectPath,
      (await SfdxPackageDirectories.getDefaultPackageDir()) ?? ''
    );

    const operation = await components.retrieve({
      usernameOrConnection: connection,
      output: defaultOutput,
      merge: true
    });

    this.setupCancellation(operation, token);

    return operation.pollStatus();
  }

  protected async handleSourceConflictError(e: any) {
    const componentPaths = e.data.map(
      (component: { filePath: any }) => component.filePath
    );
    // Retrieve operation - proceed and do not handle or throw.
    // Per the docs, the Conflict Detection at Sync
    // setting only enables conflict detection for
    // deployment operations.  For Retrieve operations
    // it is suggested to run SFDX: Diff* commands
    // to check for conflicts before retrieving.
    console.info(
      'SourceConflictError reported.  Use SFDX: Diff File Against Org and SFDX: Diff Folder Against Org to detect and view conflicts in advance of any retrieve operation.'
    );
  }

  protected async postOperation(
    result: RetrieveResult | undefined
  ): Promise<void> {
    if (result) {
      const relativePackageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
      const output = this.createOutput(result, relativePackageDirs);
      channelService.appendLine(output);
      PersistentStorageService.getInstance().setPropertiesForFilesRetrieve(
        result.response.fileProperties
      );
    }
  }

  private createOutput(
    result: RetrieveResult,
    relativePackageDirs: string[]
  ): string {
    const successes: Row[] = [];
    const failures: Row[] = [];

    for (const response of result.getFileResponses()) {
      const asRow = (response as unknown) as Row;
      response.filePath = getRelativeProjectPath(
        response.filePath,
        relativePackageDirs
      );
      if (response.state !== ComponentStatus.Failed) {
        successes.push(asRow);
      } else {
        failures.push(asRow);
      }
    }

    return this.createOutputTable(successes, failures);
  }

  private createOutputTable(successes: Row[], failures: Row[]): string {
    const table = new Table();

    let output = '';

    if (successes.length > 0) {
      output += table.createTable(
        successes,
        [
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          }
        ],
        nls.localize(`lib_retrieve_result_title`)
      );
    }

    if (failures.length > 0) {
      if (successes.length > 0) {
        output += '\n';
      }
      output += table.createTable(
        failures,
        [
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          { key: 'error', label: nls.localize('table_header_message') }
        ],
        nls.localize('lib_retrieve_message_title')
      );
    }

    return output;
  }
}
