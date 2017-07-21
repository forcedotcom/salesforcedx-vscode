/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import { workspace } from 'vscode';
import { JAVA_HOME_KEY } from '../src/requirements';

describe('Java Requirements Test', () => {
  it('Should have java.home section', () => {
    const config = workspace.getConfiguration();
    expect(config.has(JAVA_HOME_KEY)).to.be.true;
  });
});
