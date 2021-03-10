/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';

const sb = createSandbox();

describe('Base Deploy Retrieve Commands', () => {
  describe('DeployRetrieveCommand', () => {
    class TestDeployRetrieve extends DeployRetrieveExecutor<{}> {
      public lifecycle = {
        getComponentsStub: sb.stub().returns(new ComponentSet()),
        doOperationStub: sb.stub(),
        postOperationStub: sb.stub()
      };

      constructor() {
        super('test', 'testlog');
      }

      protected getComponents(
        response: ContinueResponse<{}>
      ): Promise<ComponentSet> {
        return this.lifecycle.getComponentsStub();
      }
      protected doOperation(components: ComponentSet): Promise<undefined> {
        return this.lifecycle.doOperationStub();
      }
      protected postOperation(result: undefined): Promise<void> {
        return this.lifecycle.postOperationStub();
      }
    }

    it('should call lifecycle methods in correct order', async () => {
      const executor = new TestDeployRetrieve();
      const {
        doOperationStub,
        getComponentsStub,
        postOperationStub
      } = executor.lifecycle;

      await executor.run({ data: {}, type: 'CONTINUE' });

      expect(getComponentsStub.calledOnce).to.equal(true);
      expect(doOperationStub.calledAfter(getComponentsStub)).to.equal(true);
      expect(postOperationStub.calledAfter(doOperationStub)).to.equal(true);
    });

    it('should add component count to telemetry data', async () => {
      const executor = new TestDeployRetrieve();
      const components = new ComponentSet([
        { fullName: 'MyClass', type: 'ApexClass' },
        { fullName: 'MyClass2', type: 'ApexClass' },
        { fullName: 'MyLayout', type: 'Layout' }
      ]);
      executor.lifecycle.getComponentsStub.returns(components);

      await executor.run({ data: {}, type: 'CONTINUE' });

      const { properties } = executor.telemetryData;
      expect(properties).to.not.equal(undefined);

      const { metadataCount } = properties!;
      expect(metadataCount).to.not.equal(undefined);

      const componentCount = JSON.parse(metadataCount);
      expect(componentCount).to.deep.equal([
        { type: 'ApexClass', quantity: 2 },
        { type: 'Layout', quantity: 1 }
      ]);
    });

    it('should return success when operation status is "Succeeded"', async () => {
      const executor = new TestDeployRetrieve();
      executor.lifecycle.doOperationStub.resolves({
        response: { status: RequestStatus.Succeeded }
      });

      const success = await executor.run({ data: {}, type: 'CONTINUE' });

      expect(success).to.equal(true);
    });

    it('should return success when operation status is "SucceededPartial"', async () => {
      const executor = new TestDeployRetrieve();
      executor.lifecycle.doOperationStub.resolves({
        response: { status: RequestStatus.SucceededPartial }
      });

      const success = await executor.run({ data: {}, type: 'CONTINUE' });

      expect(success).to.equal(true);
    });

    it('should return unsuccessful when operation status is "Failed"', async () => {
      const executor = new TestDeployRetrieve();
      executor.lifecycle.doOperationStub.resolves({
        response: { status: RequestStatus.Failed }
      });

      const success = await executor.run({ data: {}, type: 'CONTINUE' });

      expect(success).to.equal(false);
    });
  });

  describe('DeployCommand', () => {
    it('should call deploy on component set', () => {});

    it('should output table of deploy result', () => {});

    it('should report any diagnostics if deploy failed', () => {});

    it('should unlock the deploy queue when finished', () => {});
  });

  describe('RetrieveCommand', () => {
    it('should utilize Tooling API if retrieving one source-backed component', () => {});

    it('should output table of tooling retrieve result', () => {});

    it('should call retrieve on component set', () => {});

    it('should output table of retrieve result', () => {});
  });
});
