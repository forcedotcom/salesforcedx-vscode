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
import { ApiResult } from '@salesforce/source-deploy-retrieve';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';

export function outputRetrieveTable(retrieveResult: ApiResult) {
  if (retrieveResult.components.length === 0) {
    return retrieveResult.message
      ? retrieveResult.message
      : nls.localize(
          'lib_retrieve_result_parse_error',
          JSON.stringify(retrieveResult)
        );
  }

  let outputResult: string;
  const table = new Table();
  const title = nls.localize('lib_retrieve_result_title');
  const resultRows = [] as Row[];
  try {
    retrieveResult.components.forEach(item => {
      // rows for source files
      item.sources.forEach(sourceItem => {
        resultRows.push({
          fullName: item.fullName,
          type: item.type.name,
          filePath: sourceItem
        });
      });
      // row for xml
      resultRows.push({
        fullName: item.fullName,
        type: item.type.name,
        filePath: item.xml
      });
    });

    outputResult = table.createTable(
      resultRows,
      [
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        {
          key: 'filePath',
          label: nls.localize('table_header_project_path')
        }
      ],
      title
    );
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
