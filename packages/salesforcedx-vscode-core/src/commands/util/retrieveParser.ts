/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import {
  RetrieveMessage,
  SourceRetrieveResult
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';

export function outputRetrieveTable(retrieveResult: SourceRetrieveResult) {
  if (
    isNullOrUndefined(retrieveResult.components) ||
    retrieveResult.components?.length === 0
  ) {
    return retrieveResult.messages
      ? getMessage(retrieveResult.messages)
      : nls.localize(
          'lib_retrieve_result_parse_error',
          JSON.stringify(retrieveResult)
        );
  }

  let outputResult: string = '';
  const resultRows = [] as Row[];
  const messageRows = [] as Row[];

  try {
    for (const componentRetrieval of retrieveResult.components!) {
      const { component, diagnostics } = componentRetrieval;
      const { fullName, type } = component;
      if (diagnostics) {
        messageRows.push({
          fullName,
          type: diagnostics.type,
          message: diagnostics.message
        });
      } else {
        for (const file of component.walkContent()) {
          resultRows.push({
            fullName,
            type: type.name,
            filePath: file
          });
        }
        resultRows.push({
          fullName,
          type: type.name,
          filePath: component.xml || ''
        });
      }
    }

    const table = new Table();
    if (resultRows.length > 0) {
      const successResults = table.createTable(
        resultRows,
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

    if (messageRows.length > 0) {
      const messageResults = table.createTable(
        messageRows,
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

function getMessage(retrieveMessage: string | RetrieveMessage[]): string {
  if (typeof retrieveMessage === 'string') {
    return retrieveMessage;
  }

  let problems = '';
  for (const messageObj of retrieveMessage) {
    problems += `${messageObj.problem} `;
  }
  return problems;
}
