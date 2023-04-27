/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { nls } from '../messages';
import { SfdxProjectConfig } from '../sfdxProject';
import { RetrieveExecutor } from './retrieveExecutor';

export class LibraryRetrieveSourcePathExecutor extends RetrieveExecutor<
  string[]
> {
  constructor() {
    super(
      nls.localize('force_source_retrieve_text'),
      'force_source_retrieve_with_sourcepath_beta'
    );
  }

  public async getComponents(
    response: ContinueResponse<string[]>
  ): Promise<ComponentSet> {
    const sourceApiVersion = (await SfdxProjectConfig.getValue(
      'sourceApiVersion'
    )) as string;
    const paths =
      typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);
    componentSet.sourceApiVersion = sourceApiVersion;
    return componentSet;
  }
}
