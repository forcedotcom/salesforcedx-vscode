/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { createDirectory, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { WorkspaceContext } from '../context';

export type DescribeMetadataResult = Awaited<ReturnType<Connection['metadata']['describe']>>;

/** make an API call for the describe, and save it locally for the next time we need it */
export const describeMetadata = async (outputFolder: string): Promise<DescribeMetadataResult> => {
  await createDirectory(outputFolder);
  const filePath = path.join(outputFolder, 'metadataTypes.json');
  const connection = await WorkspaceContext.getInstance().getConnection();
  const result = await connection.metadata.describe();
  await writeFile(filePath, JSON.stringify(result, null, 2));
  return result;
};
