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
  SourceRetrieveResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import { ComponentDeployment } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { sep } from 'path';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';

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

export function createDeployOutput(
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

export function createRetrieveOutput(
  retrieveResult: SourceRetrieveResult,
  relativePackageDirs: string[]
) {
  let outputResult: string = '';
  const successRows: Row[] = [];
  const failureRows: Row[] = [];

  try {
    for (const success of retrieveResult.successes) {
      const { component, properties } = success;
      if (component) {
        const { fullName, type, xml } = component;
        for (const fsPath of component.walkContent()) {
          successRows.push({
            fullName,
            type: type.name,
            filePath: getRelativeProjectPath(fsPath, relativePackageDirs)
          });
        }
        if (xml) {
          successRows.push({
            fullName,
            type: type.name,
            filePath: getRelativeProjectPath(xml, relativePackageDirs)
          });
        }
      } else if (properties) {
        successRows.push({
          fullName: properties.fullName.split('/')[0],
          type: properties.type,
          filePath: properties.fileName
        });
      }
    }

    for (const failure of retrieveResult.failures) {
      const { component, message } = failure;
      if (component) {
        failureRows.push({
          fullName: component.fullName,
          type: 'Error',
          message
        });
      }
    }

    const table = new Table();
    if (successRows.length > 0) {
      const successResults = table.createTable(
        successRows,
        [
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          }
        ],
        nls.localize('lib_retrieve_result_title')
      );
      outputResult = outputResult.concat(successResults);
    }

    if (failureRows.length > 0) {
      const messageResults = table.createTable(
        failureRows,
        [
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_error_type') },
          { key: 'message', label: nls.localize('table_header_message') }
        ],
        nls.localize('lib_retrieve_message_title')
      );
      outputResult =
        outputResult.length > 0
          ? `${outputResult}\n${messageResults}`
          : messageResults;
    }
  } catch (e) {
    telemetryService.sendException(
      'force_source_retrieve_with_sourcepath_beta_result_format',
      e.message
    );
    outputResult = nls.localize(
      'lib_retrieve_result_parse_error',
      JSON.stringify(retrieveResult)
    );
  }
  return outputResult;
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
