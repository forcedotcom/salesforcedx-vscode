/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { SObjectDescribe } from '../describe';
import { SObjectSelector } from '../describe/sObjectDescribe';
import { DeclarationGenerator } from '../generator/declarationGenerator';
import { nls } from '../messages';
import {
  SObject,
  SObjectDefinition,
  SObjectDefinitionRetriever,
  SObjectRefreshOutput
} from '../types';

export class OrgObjectRetriever implements SObjectDefinitionRetriever {
  private describer: SObjectDescribe;
  private declGenerator: DeclarationGenerator;
  private selector: SObjectSelector;

  public constructor(connection: Connection, selector: SObjectSelector) {
    this.describer = new SObjectDescribe(connection);
    this.declGenerator = new DeclarationGenerator();
    this.selector = selector;
  }

  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    let sobjects: string[] = [];
    try {
      sobjects = await this.describer.describeGlobal(this.selector);
    } catch (e) {
      const err = JSON.parse(e);
      output.setError(
        nls.localize('failure_fetching_sobjects_list_text', err.message),
        err.stack
      );
      return;
    }

    let fetchedSObjects: SObject[] = [];
    try {
      fetchedSObjects = await this.describer.fetchObjects(sobjects);
    } catch (errorMessage) {
      output.setError(
        nls.localize('failure_in_sobject_describe_text', errorMessage)
      );
      return;
    }

    const standardSObjects: SObjectDefinition[] = [];
    const customSObjects: SObjectDefinition[] = [];
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < fetchedSObjects.length; i++) {
      if (fetchedSObjects[i].custom) {
        customSObjects.push(
          this.declGenerator.generateSObjectDefinition(fetchedSObjects[i])
        );
      } else {
        standardSObjects.push(
          this.declGenerator.generateSObjectDefinition(fetchedSObjects[i])
        );
      }
    }

    output.addStandard(standardSObjects);
    output.addCustom(customSObjects);
  }
}
