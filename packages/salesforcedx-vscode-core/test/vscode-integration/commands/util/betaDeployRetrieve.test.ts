/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve-bundle';
import { SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { createComponentCount } from '../../../../src/commands/util';
import { SalesforceCoreSettings } from '../../../../src/settings/salesforceCoreSettings';

const env = createSandbox();

describe('Deploy/Retrieve Performance Beta Utils', () => {
  const testComponents = [
    SourceComponent.createVirtualComponent(
      {
        name: 'foo',
        type: registry.types.apexclass
      },
      []
    ),
    SourceComponent.createVirtualComponent(
      {
        name: 'bar',
        type: registry.types.channellayout
      },
      []
    )
  ];

  describe('createComponentCount', () => {
    it('should correctly generate rows for telemetry', () => {
      const { name: apexClassName } = registry.types.apexclass;
      const { name: channelLayoutName } = registry.types.channellayout;
      const rows = createComponentCount(testComponents);
      expect(rows).to.deep.equal([
        { type: apexClassName, quantity: 1 },
        { type: channelLayoutName, quantity: 1 }
      ]);
    });
  });
});
