
/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { extractJsonObject } from '../../../src/helpers';

describe('getConfigSource', () => {

  it('should extract a JSON string from larger string and then return as an object', async () => {

    const exampleJsonString = JSON.stringify({ name: 'exampleName', error: 'exampleError' });
    const exampleString = `junk text <junk +text junk text ${exampleJsonString} junk text junk text junk text`;

    const testParse = extractJsonObject(exampleString);

    expect(testParse.name).to.equal('exampleName');
    expect(testParse.error).to.equal('exampleError');

  });

});

