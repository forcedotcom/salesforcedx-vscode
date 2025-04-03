/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import { JAVA_HOME_KEY, JAVA_MEMORY_KEY } from '../../src/requirements';

describe('Java Configuration Test', () => {
  it('Should have java.home section', () => {
    const config = vscode.workspace.getConfiguration();
    expect(config.has(JAVA_HOME_KEY)).to.be.true;
  });

  it('Should have java.memory section', () => {
    const config = vscode.workspace.getConfiguration();
    expect(config.has(JAVA_MEMORY_KEY)).to.be.true;
  });
});
