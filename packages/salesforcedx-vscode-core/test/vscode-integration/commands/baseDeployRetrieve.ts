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
  MetadataComponent,
  MetadataResolver,
  MetadataType,
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
import { channelService, OUTPUT_CHANNEL } from '../../../src/channels';
import { BaseDeployExecutor } from '../../../src/commands';
import { workspaceContext } from '../../../src/context';
import { handleDeployDiagnostics } from '../../../src/diagnostics';
import { nls } from '../../../src/messages';
import { DeployQueue } from '../../../src/settings';
import {
  SfdxPackageDirectories,
  SfdxProjectConfig
} from '../../../src/sfdxProject';

type RetrieveResult = MetadataApiRetrieveResult | SourceRetrieveResult;
type DeployRetrieveResult = DeployResult | RetrieveResult | undefined;

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
    return result instanceof DeployResult ||
      result instanceof MetadataApiRetrieveResult
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

export abstract class RetrieveCommand<T> extends DeployRetrieveCommand<T> {
  protected async getOperation(
    components: ComponentSet
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

    return components
      .retrieve({
        usernameOrConnection: connection,
        output: defaultOutput,
        merge: true
      })
      .start();
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
            filePath: getRelativeProjectPath(fsPath, relativePackageDirs)
          });
        }
        if (xml) {
          successes.push({
            fullName,
            type: type.name,
            filePath: getRelativeProjectPath(xml, relativePackageDirs)
          });
        }
      } else if (properties) {
        successes.push({
          fullName: properties.fullName.split('/')[0],
          type: properties.type,
          filePath: properties.fileName
        });
      }
    }

    for (const failure of retrieveResult.failures) {
      const { component, message } = failure;
      if (component) {
        failures.push({
          fullName: component.fullName,
          type: 'Error',
          message
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
      return permittedTypeNames.includes(component.type.name);
    }
    return false;
  }
}
