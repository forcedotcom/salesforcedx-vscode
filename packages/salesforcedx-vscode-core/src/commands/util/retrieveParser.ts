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
  SourceRetrieveResult
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';

export function outputRetrieveTable(retrieveResult: SourceRetrieveResult) {
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
            filePath: fsPath
          });
        }
        if (xml) {
          successRows.push({
            fullName,
            type: type.name,
            filePath: xml
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
      outputResult = outputResult.concat('\n' + messageResults);
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
