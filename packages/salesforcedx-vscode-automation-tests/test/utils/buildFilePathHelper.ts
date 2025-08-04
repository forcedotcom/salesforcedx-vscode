/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';

export const getFolderPath = (projectPath: string, folder: string): string => path.join(projectPath, 'force-app', 'main', 'default', folder);
