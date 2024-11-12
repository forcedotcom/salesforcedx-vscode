/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as minSObjectsFromFile from '../../src/data/minSObjects.json';
import { SObjectShortDescription } from '../describe';
import { SObject, SObjectDefinitionRetriever, SObjectRefreshOutput } from '../types';

type minSObjectsFileFormat = {
  typeNames: SObjectShortDescription[];
  standard: SObject[];
};

export class MinObjectRetriever implements SObjectDefinitionRetriever {
  public async retrieve(output: SObjectRefreshOutput): Promise<void> {
    // TODO: validate the file format at runtime
    const minMetadata = minSObjectsFromFile as minSObjectsFileFormat;
    output.addTypeNames(minMetadata.typeNames);
    output.addStandard(minMetadata.standard);
  }
}
