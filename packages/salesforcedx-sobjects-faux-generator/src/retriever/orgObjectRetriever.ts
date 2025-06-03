/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { SObjectDescribe, SObjectSelector, SObjectShortDescription } from '../describe';

import { nls } from '../messages';
import { SObjectDefinitionRetriever, SObjectRefreshOutput } from '../types';

export class OrgObjectRetriever implements SObjectDefinitionRetriever {
  private describer: SObjectDescribe;

  public constructor(connection: Connection) {
    this.describer = new SObjectDescribe(connection);
  }

  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    let sobjects: SObjectShortDescription[] = [];
    try {
      sobjects = await this.describer.describeGlobal();
    } catch (e) {
      const err = JSON.parse(e);
      output.setError(nls.localize('failure_fetching_sobjects_list_text', err.message), err.stack);
      return;
    }
    output.addTypeNames(sobjects);
  }
}

export class OrgObjectDetailRetriever implements SObjectDefinitionRetriever {
  private describer: SObjectDescribe;
  private selector: SObjectSelector;
  public constructor(connection: Connection, selector: SObjectSelector) {
    this.describer = new SObjectDescribe(connection);
    this.selector = selector;
  }

  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    const retrieveTypes: string[] = this.selectedTypes(output.getTypeNames());

    try {
      const fetchedSObjects = await this.describer.fetchObjects(retrieveTypes);
      output.addStandard(fetchedSObjects.filter(o => !o.custom));
      output.addCustom(fetchedSObjects.filter(o => o.custom));
    } catch (errorMessage) {
      output.setError(nls.localize('failure_in_sobject_describe_text', errorMessage));
      return;
    }
  }

  private selectedTypes(types: SObjectShortDescription[]): string[] {
    return types.reduce((acc: string[], sobject) => {
      if (this.selector.select(sobject)) {
        acc.push(sobject.name);
      }
      return acc;
    }, []);
  }
}
