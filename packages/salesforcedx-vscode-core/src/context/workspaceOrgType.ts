/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspaceUtils, getTargetOrgOrAlias as getTargetOrgOrAliasUtil } from '@salesforce/salesforcedx-utils-vscode';

export const getTargetOrgOrAlias = (): Promise<string | undefined> =>
  workspaceUtils.hasRootWorkspace() ? getTargetOrgOrAliasUtil(true) : Promise.resolve(undefined);
