/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as minSObjectsFromFile from '../../src/data/minSObjects.json';
import { SObjectShortDescription } from '../describe';
import { MODIFIER } from '../generator/declarationGenerator';
import {
  SObjectDefinition,
  SObjectDefinitionRetriever,
  SObjectRefreshOutput
} from '../types';

export class MinObjectRetriever implements SObjectDefinitionRetriever {
  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    const defs = (minSObjectsFromFile as SObjectDefinition[]) || [];

    const typeNames: SObjectShortDescription[] = [];
    defs.forEach(sobject => {
      typeNames.push({ name: sobject.name, custom: false });
      sobject.fields.forEach(field => {
        field.modifier = MODIFIER;
      });
    });

    output.addStandard(defs);
    output.addTypeNames(typeNames);
  }
}
