/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { WorkspaceContext } from '../context';

export const describeMetadata = async (outputFolder: string): Promise<string> => {
  await fs.promises.mkdir(outputFolder, { recursive: true });
  const filePath = path.join(outputFolder, 'metadataTypes.json');
  const connection = await WorkspaceContext.getInstance().getConnection();
  const result = await connection.metadata.describe();
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return JSON.stringify(result, null, 2);
};
