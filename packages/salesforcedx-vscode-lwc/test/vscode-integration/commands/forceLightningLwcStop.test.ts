import * as sinon from 'sinon';
import { forceLightningLwcStop } from '../../../src/commands/forceLightningLwcStop';
import { DevServerService } from '../../../src/service/devServerService';

describe('forceLightningLwcStop', () => {
  it('calls stopServer when a server is already running', async () => {
    const service = new DevServerService();
    const instanceStub = sinon
      .stub(DevServerService, 'instance')
      .get(() => service);

    const stopStub = sinon.stub();
    service.registerServerHandler({
      stop: stopStub
    });

    await forceLightningLwcStop();
    sinon.assert.calledOnce(stopStub);

    instanceStub.restore();
  });
});
