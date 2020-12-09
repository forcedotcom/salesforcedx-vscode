/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import {
  DeployStatus,
  SourceDeployResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import { ComponentDeployment } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { sep } from 'path';
import { nls } from '../../messages';

type ComponentSuccess = {
  state: string;
  fullName: string;
  type: string;
  filePath?: string;
};

type ComponentFailure = {
  filePath?: string;
  error: string;
};

export function outputDeployTable(
  result: SourceDeployResult,
  relativePackageDirs: string[]
): string {
  let outputResult: ComponentSuccess[] | ComponentFailure[];
  let formatResult: string;
  let table = new Table();

  const { components, status } = result;

  switch (status) {
    case DeployStatus.Succeeded:
    case ToolingDeployStatus.Completed:
      table = new Table();
      outputResult = buildSuccesses(components, relativePackageDirs);
      formatResult = table.createTable(
        (outputResult as unknown) as Row[],
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
      break;
    case ToolingDeployStatus.Error:
    case DeployStatus.Failed:
    case ToolingDeployStatus.Failed:
      table = new Table();
      outputResult = buildErrors(components, relativePackageDirs);
      formatResult = table.createTable(
        (outputResult as unknown) as Row[],
        [
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          },
          { key: 'error', label: nls.localize('table_header_errors') }
        ],
        nls.localize(`table_title_deploy_errors`)
      );
      break;
    case ToolingDeployStatus.Queued:
    case DeployStatus.Pending:
    case DeployStatus.InProgress:
      formatResult = nls.localize('beta_tapi_queue_status');
      break;
    default:
      formatResult = '';
  }
  return formatResult;
}

function buildSuccesses(
  deployments: ComponentDeployment[] | undefined,
  packageDirs: string[]
) {
  const successes: ComponentSuccess[] = [];

  if (deployments) {
    for (const deployment of deployments) {
      const { component } = deployment;
      const listOfFiles = [...component.walkContent(), component.xml];
      const success = listOfFiles.map(file => ({
        state: deployment.status,
        fullName: component.fullName,
        type: component.type.name,
        filePath: getRelativeProjectPath(file, packageDirs)
      }));
      successes.push(...success);
    }
  }

  return successes;
}

function buildErrors(
  deployments: ComponentDeployment[] | undefined,
  packageDirs: string[]
) {
  const failures: ComponentFailure[] = [];
  if (deployments) {
    for (const deployment of deployments) {
      for (const diagnostic of deployment.diagnostics) {
        const { filePath, message, lineNumber, columnNumber } = diagnostic;
        const row: ComponentFailure = {
          error: message,
          filePath: getRelativeProjectPath(filePath, packageDirs)
        };
        if (filePath && columnNumber && lineNumber) {
          row.error += ` (${lineNumber}:${columnNumber})`;
        }
        failures.push(row);
      }
    }
  }
  return failures;
}

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

export class LibraryDeployResultParser {
  private packageDirPattern: RegExp;

  constructor(packagePaths: string[]) {
    this.packageDirPattern = new RegExp(`(.*)(?=${packagePaths.join('|')})`);
  }

  public resultParser(
    result: SourceDeployResult,
    relativePackageDirs: string[]
  ) {
    let outputResult: ComponentSuccess[] | ComponentFailure[];
    let formatResult: string;
    let table = new Table();
    const packageDirPattern = new RegExp(
      `(.*)(?=${relativePackageDirs.join('|')})`
    );
    switch (result.status) {
      case DeployStatus.Succeeded:
      case ToolingDeployStatus.Completed:
        table = new Table();
        outputResult = this.buildSuccesses(result);
        formatResult = table.createTable(
          (outputResult as unknown) as Row[],
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
        break;
      case ToolingDeployStatus.Error:
      case DeployStatus.Failed:
      case ToolingDeployStatus.Failed:
        table = new Table();
        outputResult = this.buildErrors(result);
        formatResult = table.createTable(
          (outputResult as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        break;
      case ToolingDeployStatus.Queued:
      case DeployStatus.Pending:
      case DeployStatus.InProgress:
        formatResult = nls.localize('beta_tapi_queue_status');
        break;
      default:
        formatResult = '';
    }
    return formatResult;
  }

  private buildSuccesses(result: SourceDeployResult) {
    const successes: ComponentSuccess[] = [];
    const { components: deployments } = result;

    if (deployments) {
      for (const deployment of deployments) {
        const { component } = deployment;
        const listOfFiles = [...component.walkContent(), component.xml];
        const success = listOfFiles.map(file => ({
          state: deployment.status,
          fullName: component.fullName,
          type: component.type.name,
          filePath: file?.replace(this.packageDirPattern, '')
        }));
        successes.push(...success);
      }
    }

    return successes;
  }

  private buildErrors(result: SourceDeployResult) {
    const failures: ComponentFailure[] = [];

    const { components: deployments } = result;
    if (deployments) {
      for (const deployment of deployments) {
        for (const diagnostic of deployment.diagnostics) {
          const { filePath, message, lineNumber, columnNumber } = diagnostic;
          const row: ComponentFailure = {
            error: message,
            filePath: (filePath || '').replace(this.packageDirPattern, '')
          };
          if (filePath && columnNumber && lineNumber) {
            row.error += ` (${lineNumber}:${columnNumber})`;
          }
          failures.push(row);
        }
      }
    }

    return failures;
  }
}
