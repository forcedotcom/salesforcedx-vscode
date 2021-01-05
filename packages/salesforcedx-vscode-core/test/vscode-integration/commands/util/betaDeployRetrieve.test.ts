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
import {
  createComponentCount,
  useBetaDeployRetrieve
} from '../../../../src/commands/util';
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

  describe('useBetaDeployRetrieve', () => {
    let settingStub: SinonStub;
    let registryStub: SinonStub;

    const uriOne = vscode.Uri.file('classes/foo.cls');
    const uriTwo = vscode.Uri.parse(
      'channelLayouts/bar.channelLayout-meta.xml'
    );

    beforeEach(() => {
      settingStub = env
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(true);
      const wsOne = new ComponentSet();
      wsOne.add(testComponents[0]);
      const wsTwo = new ComponentSet();
      wsTwo.add(testComponents[1]);
      registryStub = env
        .stub(ComponentSet.prototype, 'resolveSourceComponents')
        .withArgs(uriOne.fsPath)
        .returns(wsOne)
        .withArgs(uriTwo.fsPath)
        .returns(wsTwo);
    });

    afterEach(() => {
      env.restore();
    });

    it('should return true when beta configuration is enabled', () => {
      expect(useBetaDeployRetrieve([uriOne])).to.equal(true);
      expect(settingStub.calledBefore(registryStub)).to.equal(true);
    });

    it('should return false when beta configuration is disabled', () => {
      settingStub.returns(false);

      expect(useBetaDeployRetrieve([uriOne])).to.equal(false);
      expect(registryStub.notCalled).to.equal(true);
    });

    it("should return true if a component's type is marked as supported", () => {
      expect(
        useBetaDeployRetrieve([uriOne], [registryData.types.apexclass])
      ).to.equal(true);
    });

    it("should return false if a component's type is not marked as supported", () => {
      expect(
        useBetaDeployRetrieve([uriTwo], [registryData.types.apexclass])
      ).to.equal(false);
    });

    it('should return as expected for multiple uris', () => {
      const permittedTypes = [
        registryData.types.apexclass,
        registryData.types.channellayout
      ];
      expect(useBetaDeployRetrieve([uriOne, uriTwo], permittedTypes)).to.equal(
        true
      );
      expect(useBetaDeployRetrieve([uriOne, uriTwo], [])).to.equal(false);
    });
  });

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
