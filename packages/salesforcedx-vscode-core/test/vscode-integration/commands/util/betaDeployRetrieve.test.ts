/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, registryData } from '@salesforce/source-deploy-retrieve';
import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { createComponentCount } from '../../../../src/commands/util';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

const env = createSandbox();

describe('Deploy/Retrieve Performance Beta Utils', () => {
  const testComponents = [
    SourceComponent.createVirtualComponent(
      {
        name: 'foo',
        type: registryData.types.apexclass
      },
      []
    ),
    SourceComponent.createVirtualComponent(
      {
        name: 'bar',
        type: registryData.types.channellayout
      },
      []
    )
  ];

  describe('createComponentCount', () => {
    it('should correctly generate rows for telemetry', () => {
      const { name: apexClassName } = registryData.types.apexclass;
      const { name: channelLayoutName } = registryData.types.channellayout;
      const rows = createComponentCount(testComponents);
      expect(rows).to.deep.equal([
        { type: apexClassName, quantity: 1 },
        { type: channelLayoutName, quantity: 1 }
      ]);
    });
  });
});
