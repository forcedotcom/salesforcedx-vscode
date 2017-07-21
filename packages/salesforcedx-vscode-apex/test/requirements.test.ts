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
