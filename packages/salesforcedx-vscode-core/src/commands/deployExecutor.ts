import {
  ConfigUtil,
  getRelativeProjectPath,
  getRootWorkspacePath,
  Row,
  SfdxCommandBuilder,
  SourceTrackingService,
  Table
} from '@salesforce/salesforcedx-utils-vscode/src';
import {
  ComponentSet,
  DeployResult,
  RequestStatus
} from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { MetadataCacheService, PersistentStorageService } from '../conflict';
import { TimestampConflictDetector } from '../conflict/timestampConflictDetector';
import { WorkspaceContext } from '../context';
import { handleDeployDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { DeployQueue } from '../settings';
import { SfdxPackageDirectories } from '../sfdxProject';
import { workspaceUtils } from '../util';
import { BaseDeployExecutor } from './baseDeployExecutor';
import { DeployRetrieveExecutor } from './deployRetrieveExecutor';
import { ConflictDetectionMessages } from './util';
import { TimestampConflictChecker } from './util/postconditionCheckers';

export abstract class DeployExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<DeployResult | undefined> {
    const projectPath = getRootWorkspacePath();
    const connection = await WorkspaceContext.getInstance().getConnection();

    const sourceTracking = await SourceTrackingService.createSourceTracking(
      projectPath,
      connection
    );

    const operation = await components.deploy({
      usernameOrConnection: connection
    });

    this.setupCancellation(operation, token);

    return operation.pollStatus();
  }

  protected async handleSourceConflictError(e: any) {
    const componentPaths = e.data.map(
      (component: { filePath: any }) => component.filePath
    );
    const username = await ConfigUtil.getUsername();
    const metadataCacheService = new MetadataCacheService(String(username));
    const cacheResult = await metadataCacheService.loadCache(
      componentPaths,
      workspaceUtils.getRootWorkspacePath(),
      false
    );

    const detector = new TimestampConflictDetector();
    const diffs = detector.createDiffs(cacheResult, true);

    const conflictMessages = this.getMessagesFor(this.logName);
    if (conflictMessages) {
      const conflictChecker = new TimestampConflictChecker(
        false,
        conflictMessages
      );
      await conflictChecker.handleConflicts(
        componentPaths,
        String(username),
        diffs
      );
    }
  }

  private getMessagesFor(
    logName: string
  ): ConflictDetectionMessages | undefined {
    const messagesByLogName: Map<string, ConflictDetectionMessages> = new Map();
    const warningMessageKey = 'conflict_detect_conflicts_during_deploy';

    messagesByLogName.set('force_source_deploy_with_sourcepath_beta', {
      warningMessageKey,
      commandHint: inputs => {
        const commands: string[] = [];
        (inputs as string[]).forEach(input => {
          commands.push(
            new SfdxCommandBuilder()
              .withArg('force:source:deploy')
              .withFlag('--sourcepath', input)
              .build()
              .toString()
          );
        });
        const hints = commands.join('\n  ');

        return hints;
      }
    });
    messagesByLogName.set('force_source_deploy_with_manifest_beta', {
      warningMessageKey,
      commandHint: input => {
        return new SfdxCommandBuilder()
          .withArg('force:source:deploy')
          .withFlag('--manifest', input as string)
          .build()
          .toString();
      }
    });

    const conflictMessages = messagesByLogName.get(logName);
    if (!conflictMessages) {
      throw new Error(`No conflict messages found for ${logName}`);
    }
    return conflictMessages;
  }

  protected async postOperation(
    result: DeployResult | undefined
  ): Promise<void> {
    try {
      if (result) {
        BaseDeployExecutor.errorCollection.clear();

        // Update Persistent Storage for the files that were deployed
        PersistentStorageService.getInstance().setPropertiesForFilesDeploy(
          result
        );

        const relativePackageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
        const output = this.createOutput(result, relativePackageDirs);
        channelService.appendLine(output);

        const success = result.response.status === RequestStatus.Succeeded;
        if (!success) {
          handleDeployDiagnostics(result, BaseDeployExecutor.errorCollection);
        }
      }
    } finally {
      await DeployQueue.get().unlock();
    }
  }

  private createOutput(
    result: DeployResult,
    relativePackageDirs: string[]
  ): string {
    const table = new Table();

    const rowsWithRelativePaths = (result.getFileResponses().map(response => {
      response.filePath = getRelativeProjectPath(
        response.filePath,
        relativePackageDirs
      );
      return response;
    }) as unknown) as Row[];

    let output: string;

    if (result.response.status === RequestStatus.Succeeded) {
      output = table.createTable(
        rowsWithRelativePaths,
        [
          { key: 'state', label: nls.localize('table_header_state') },
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          }
        ],
        nls.localize(`table_title_deployed_source`)
      );
    } else {
      output = table.createTable(
        rowsWithRelativePaths.filter(row => row.error),
        [
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          },
          { key: 'error', label: nls.localize('table_header_errors') }
        ],
        nls.localize(`table_title_deploy_errors`)
      );
    }

    return output;
  }
}
