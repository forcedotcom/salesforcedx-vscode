/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { SObjectShortDescription } from '../describe';
import { SObjectDescribe } from '../describe/sObjectDescribe';
import { nls } from '../messages';
import { SObjectCategory, SObjectDefinitionRetriever, SObjectRefreshOutput, SObjectRefreshSource } from '../types';

export class OrgObjectRetriever implements SObjectDefinitionRetriever {
  private describer: SObjectDescribe;

  public constructor(connection: Connection) {
    this.describer = new SObjectDescribe(connection);
  }

  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    try {
      const sobjects = await this.describer.describeGlobal();
      output.addTypeNames(sobjects);
    } catch (e) {
      const err = JSON.parse(e);
      output.setError(nls.localize('failure_fetching_sobjects_list_text', err.message), err.stack);
      return;
    }
  }
}

export class OrgObjectDetailRetriever implements SObjectDefinitionRetriever {
  private describer: SObjectDescribe;
  private category: SObjectCategory;
  private source: SObjectRefreshSource;
  public constructor(connection: Connection, category: SObjectCategory, source: SObjectRefreshSource) {
    this.describer = new SObjectDescribe(connection);
    this.category = category;
    this.source = source;
  }

  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    const retrieveTypes: string[] = output
      .getTypeNames()
      .filter(sobjectFilter(this.category, this.source))
      .map(t => t.name);

    try {
      const fetchedSObjects = await this.describer.fetchObjects(retrieveTypes);
      output.addStandard(fetchedSObjects.filter(o => !o.custom));
      output.addCustom(fetchedSObjects.filter(o => o.custom));
    } catch (errorMessage) {
      output.setError(nls.localize('failure_in_sobject_describe_text', errorMessage));
      return;
    }
  }
}

export const sobjectFilter =
  (category: SObjectCategory, source: SObjectRefreshSource) => (sobject: SObjectShortDescription) => {
    const isCustomObject = sobject.custom === true && category === 'CUSTOM';
    const isStandardObject = sobject.custom === false && category === 'STANDARD';

    if (category === 'ALL' && source === 'manual') {
      return true;
    } else if (
      category === 'ALL' &&
      (source === 'startupmin' || source === 'startup') &&
      isRequiredSObject(sobject.name)
    ) {
      return true;
    } else if ((isCustomObject || isStandardObject) && source === 'manual' && isRequiredSObject(sobject.name)) {
      return true;
    }
    return false;
  };

/* Ignore all sobjects that end with Share or History or Feed or Event */

const isRequiredSObject = (sobject: string): boolean => !/Share$|History$|Feed$|.+Event$/.test(sobject);
