/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  getRootWorkspacePath,
  LibraryCommandletExecutor
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  DeployResult,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  MetadataComponent,
  MetadataResolver,
  registryData,
  RetrieveResult as MetadataApiRetrieveResult,
  SourceRetrieveResult,
  ToolingApi
} from '@salesforce/source-deploy-retrieve';
import {
  ComponentStatus,
  RequestStatus
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { join, sep } from 'path';
import * as vscode from 'vscode';
import { BaseDeployExecutor } from '.';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { TELEMETRY_METADATA_COUNT } from '../constants';
import { workspaceContext } from '../context';
import { handleDeployDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { DeployQueue } from '../settings';
import { SfdxPackageDirectories, SfdxProjectConfig } from '../sfdxProject';
import { createComponentCount } from './util';

type RetrieveResult = MetadataApiRetrieveResult | SourceRetrieveResult;
type DeployRetrieveResult = DeployResult | RetrieveResult;
type DeployRetrieveOperation = MetadataApiDeploy | MetadataApiRetrieve;

export abstract class DeployRetrieveExecutor<
  T
  > extends LibraryCommandletExecutor<T> {

  protected cancellable: boolean = true;

  constructor(executionName: string, logName: string) {
    super(executionName, logName, OUTPUT_CHANNEL);
  }

  public async run(
    response: ContinueResponse<T>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    let result: DeployRetrieveResult | undefined;

    try {
      const components = await this.getComponents(response);

      this.telemetry.addProperty(
        TELEMETRY_METADATA_COUNT,
        JSON.stringify(createComponentCount(components))
      );

      result = await this.doOperation(components, token);

      const status = this.getStatus(result);

      return (
        status === RequestStatus.Succeeded ||
        status === RequestStatus.SucceededPartial
      );
    } finally {
      await this.postOperation(result);
    }
  }

  protected getRelativeProjectPath(fsPath: string = '', packageDirs: string[]) {
    let packageDirIndex;
    for (let packageDir of packageDirs) {
      if (!packageDir.startsWith(sep)) {
        packageDir = sep + packageDir;
      }
      if (!packageDir.endsWith(sep)) {
        packageDir = packageDir + sep;
      }
      packageDirIndex = fsPath.indexOf(packageDir);
      if (packageDirIndex !== -1) {
        packageDirIndex += 1;
        break;
      }
    }
    return packageDirIndex !== -1 ? fsPath.slice(packageDirIndex) : fsPath;
  }

  private getStatus(
    result: DeployRetrieveResult | undefined
  ): RequestStatus | undefined {
    return result && 'response' in result
      ? result.response.status
      : result?.status;
  }

  protected setupCancellation(operation: DeployRetrieveOperation | undefined, token?: vscode.CancellationToken) {
    if (token && operation) {
      token.onCancellationRequested(() => {
        operation.cancel();
      });
    }
  }

  protected abstract getComponents(
    response: ContinueResponse<T>
  ): Promise<ComponentSet>;
  protected abstract doOperation(
    components: ComponentSet, token?: vscode.CancellationToken
  ): Promise<DeployRetrieveResult | undefined>;
  protected abstract postOperation(
    result: DeployRetrieveResult | undefined
  ): Promise<void>;
}

export abstract class DeployExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet, token: vscode.CancellationToken
  ): Promise<DeployResult | undefined> {
    const operation = components
      .deploy({
        usernameOrConnection: await workspaceContext.getConnection()
      });

    this.setupCancellation(operation, token);

    return operation.start();
  }

  protected async postOperation(
    result: DeployResult | undefined
  ): Promise<void> {
    try {
      if (result) {
        BaseDeployExecutor.errorCollection.clear();

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
      response.filePath = this.getRelativeProjectPath(
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

export abstract class RetrieveExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet, token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    const connection = await workspaceContext.getConnection();

    // utilize the tooling API for single component retrieves for improved performance
    const oneComponent = components.getSourceComponents().first();

    if (components.size === 1 && this.isToolingSupported(oneComponent)) {
      const projectNamespace = (await SfdxProjectConfig.getValue(
        'namespace'
      )) as string;
      const tooling = new ToolingApi(connection, new MetadataResolver());
      return tooling.retrieve({
        components,
        namespace: projectNamespace
      });
    }

    const defaultOutput = join(
      getRootWorkspacePath(),
      (await SfdxPackageDirectories.getDefaultPackageDir()) ?? ''
    );

    const operation = components
      .retrieve({
        usernameOrConnection: connection,
        output: defaultOutput,
        merge: true
      });

    this.setupCancellation(operation, token);

    return operation.start();
  }

  protected async postOperation(
    result: RetrieveResult | SourceRetrieveResult | undefined
  ): Promise<void> {
    if (result) {
      const relativePackageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();

      let output: string;

      if (result instanceof MetadataApiRetrieveResult) {
        output = this.createOutput(result, relativePackageDirs);
      } else {
        output = this.createToolingOutput(result, relativePackageDirs);
      }

      channelService.appendLine(output);
    }
  }

  private createOutput(
    result: MetadataApiRetrieveResult,
    relativePackageDirs: string[]
  ): string {
    const successes: Row[] = [];
    const failures: Row[] = [];

    for (const response of result.getFileResponses()) {
      const asRow = (response as unknown) as Row;
      response.filePath = this.getRelativeProjectPath(
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

  /**
   * This exists because the Tooling API result currently doesn't conform to the
   * same interface as the Metadata API deploy and retrieve result objects.
   */
  private createToolingOutput(
    retrieveResult: SourceRetrieveResult,
    relativePackageDirs: string[]
  ): string {
    const successes: Row[] = [];
    const failures: Row[] = [];

    for (const success of retrieveResult.successes) {
      const { component, properties } = success;
      if (component) {
        const { fullName, type, xml } = component;
        for (const fsPath of component.walkContent()) {
          successes.push({
            fullName,
            type: type.name,
            filePath: this.getRelativeProjectPath(fsPath, relativePackageDirs)
          });
        }
        if (xml) {
          successes.push({
            fullName,
            type: type.name,
            filePath: this.getRelativeProjectPath(xml, relativePackageDirs)
          });
        }
      }
    }

    for (const failure of retrieveResult.failures) {
      const { component, message } = failure;
      if (component) {
        failures.push({
          fullName: component.fullName,
          type: component.type.name,
          error: message
        });
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

  private isToolingSupported(
    component: MetadataComponent | undefined
  ): boolean {
    if (component) {
      const { types } = registryData;
      const permittedTypeNames = [
        types.auradefinitionbundle.name,
        types.lightningcomponentbundle.name,
        types.apexclass.name,
        types.apexcomponent.name,
        types.apexpage.name,
        types.apextrigger.name
      ];
      return (
        component.fullName !== '*' &&
        permittedTypeNames.includes(component.type.name)
      );
    }
    return false;
  }
}
