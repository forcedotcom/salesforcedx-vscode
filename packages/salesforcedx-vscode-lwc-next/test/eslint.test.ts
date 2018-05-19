/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* tslint:disable:no-unused-expression */
import { expect } from 'chai';
import { stub } from 'sinon';
import { ExtensionContext, WorkspaceConfiguration } from 'vscode';
import { LWC_EXTENSION_NAME } from '../src/constants';
import { populateEslintSettingIfNecessary } from '../src/index';

describe('LWC ESlint Unit Tests', () => {
  const mContext = {
    asAbsolutePath: () => {
      return '';
    }
  };

  before(() => {
    stub(mContext, 'asAbsolutePath').returns('with_mocked_location');
  });

  it('Should update eslint.nodePath if not set', async () => {
    let called = false;
    await populateEslintSettingIfNecessary(
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

  it('Should update eslint.nodePath if set to salesforcedx-vscode-lwc', async () => {
    let called = false;
    await populateEslintSettingIfNecessary(
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

  it('Should not update eslint.nodePath if set to another path', async () => {
    let called = false;
    await populateEslintSettingIfNecessary(
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
