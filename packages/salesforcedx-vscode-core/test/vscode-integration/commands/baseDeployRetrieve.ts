import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  DeployResult,
  MetadataComponent,
  RetrieveResult,
  SourceRetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { MetadataTransfer } from '@salesforce/source-deploy-retrieve/lib/src/client/metadataTransfer';
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { sep } from 'path';
import { channelService, OUTPUT_CHANNEL } from '../../../src/channels';
import { BaseDeployExecutor } from '../../../src/commands';
import { createDeployOutput2 } from '../../../src/commands/util/sourceResultOutput';
import { handleDeployDiagnostics } from '../../../src/diagnostics';
import { nls } from '../../../src/messages';
import { DeployQueue } from '../../../src/settings';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';

type DeployRetrieveResult =
  | DeployResult
  | RetrieveResult
  | SourceRetrieveResult
  | undefined;

function getRelativeProjectPath(fsPath: string = '', packageDirs: string[]) {
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

abstract class DeployRetrieveCommand<T> extends LibraryCommandletExecutor<T> {
  constructor(executionName: string, logName: string) {
    super(executionName, logName, OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<T>): Promise<boolean> {
    let result: DeployRetrieveResult;

    try {
      const components = await this.getComponents(response);

      this.telemetry.addProperty(
        'metadataCount',
        this.createComponentCount(components)
      );

      result = await this.getOperation(components);

      const status = this.getStatus(result);

      return (
        status === RequestStatus.Succeeded ||
        status === RequestStatus.SucceededPartial
      );
    } finally {
      await this.postOperation(result);
    }
  }

  private createComponentCount(
    components: Iterable<MetadataComponent>
  ): string {
    const quantities: { [type: string]: number } = {};
    for (const component of components) {
      const { name: typeName } = component.type;
      const typeCount = quantities[typeName];
      quantities[typeName] = typeCount ? typeCount + 1 : 1;
    }
    return JSON.stringify(
      Object.keys(quantities).map(type => ({
        type,
        quantity: quantities[type]
      }))
    );
  }

  protected getStatus(result: DeployRetrieveResult): RequestStatus | undefined {
    return result instanceof DeployResult || result instanceof RetrieveResult
      ? result.response.status
      : result?.status;
  }

  protected abstract getComponents(
    response: ContinueResponse<T>
  ): Promise<ComponentSet>;
  protected abstract getOperation(
    components: ComponentSet
  ): Promise<DeployRetrieveResult>;
  protected abstract postOperation(result: DeployRetrieveResult): Promise<void>;
}

export abstract class DeployCommand<T> extends DeployRetrieveCommand<T> {
  protected async postOperation(
    result: DeployResult | undefined
  ): Promise<void> {
    try {
      if (result) {
        BaseDeployExecutor.errorCollection.clear();

        this.outputResults(result);

        const success = result.response.status === RequestStatus.Succeeded;

        if (!success) {
          handleDeployDiagnostics(result, BaseDeployExecutor.errorCollection);
        }
      }
    } finally {
      await DeployQueue.get().unlock();
    }
  }

  private async outputResults(result: DeployResult): Promise<void> {
    const table = new Table();

    const relativePackageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();

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

    channelService.appendLine(output);
  }

  protected abstract getOperation(
    components: ComponentSet
  ): Promise<DeployResult | undefined>;
}
