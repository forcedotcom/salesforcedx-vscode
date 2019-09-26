/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import {
  SObjectRefreshSelection,
  SObjectRefreshSource
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { window } from 'vscode';
import { nls } from '../../messages';

export class SObjectRefreshGatherer
  implements ParametersGatherer<SObjectRefreshSelection> {
  private source?: SObjectRefreshSource;

  public constructor(source?: SObjectRefreshSource) {
    this.source = source;
  }

  public async gather(): Promise<
    ContinueResponse<SObjectRefreshSelection> | CancelResponse
  > {
    let category: SObjectCategory | undefined = SObjectCategory.ALL;
    if (!this.source || this.source === SObjectRefreshSource.Manual) {
      category = await this.promptCategory();
      if (!category) {
        return { type: 'CANCEL' };
      }
    }
    return {
      type: 'CONTINUE',
      data: {
        category,
        source: this.source || SObjectRefreshSource.Manual
      }
    };
  }

  private async promptCategory(): Promise<SObjectCategory | undefined> {
    const options = [
      nls.localize('sobject_refresh_all'),
      nls.localize('sobject_refresh_project'),
      nls.localize('sobject_refresh_custom'),
      nls.localize('sobject_refresh_standard')
    ];
    switch (await window.showQuickPick(options)) {
      case options[0]:
        return SObjectCategory.ALL;
      case options[1]:
        return SObjectCategory.PROJECT;
      case options[2]:
        return SObjectCategory.CUSTOM;
      case options[3]:
        return SObjectCategory.STANDARD;
    }
  }
}
