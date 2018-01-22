/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { stub } from 'sinon';
import { ExtensionContext, workspace, WorkspaceConfiguration } from 'vscode';
import { ESLINT_NODEPATH_CONFIG, LWC_EXTENSION_NAME } from '../src/constants';
import { populateEslintSettingIfNecessary } from '../src/index';

// tslint:disable:no-unused-expression
describe('LWC ESlint Integration Tests', () => {
  it('Should configure eslint.nodePath on sfdx-simple', () => {
    expect(
      workspace.getConfiguration().get<string>(ESLINT_NODEPATH_CONFIG)
    ).to.contain(LWC_EXTENSION_NAME);
  });
});

describe('LWC ESlint Unit Tests', () => {
  const mContext = {
    asAbsolutePath: () => {
      return '';
    }
  };

  before(() => {
    stub(mContext, 'asAbsolutePath').returns('with_mocked_location');
  });

  it('Should update eslint.nodePath if not set', () => {
    let called = false;
    populateEslintSettingIfNecessary(
      (mContext as any) as ExtensionContext,
      ({
        get: () => {
          return null;
        },
        update: () => {
          called = true;
        }
      } as any) as WorkspaceConfiguration
    );
    expect(called).to.be.true;
  });

  it('Should update eslint.nodePath if set to salesforcedx-vscode-lwc', () => {
    let called = false;
    populateEslintSettingIfNecessary(
      (mContext as any) as ExtensionContext,
      ({
        get: () => {
          return LWC_EXTENSION_NAME;
        },
        update: () => {
          called = true;
        }
      } as any) as WorkspaceConfiguration
    );
    expect(called).to.be.true;
  });

  it('Should not update eslint.nodePath if set to another path', () => {
    let called = false;
    populateEslintSettingIfNecessary(
      (mContext as any) as ExtensionContext,
      ({
        get: () => {
          return 'some_other_path';
        },
        update: () => {
          called = true;
        }
      } as any) as WorkspaceConfiguration
    );
    expect(called).to.be.false;
  });
});
