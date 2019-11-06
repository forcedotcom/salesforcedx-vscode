import * as sinon from 'sinon';
import { forceLightningLwcStop } from '../../../src/commands/forceLightningLwcStop';
import { DevServerService } from '../../../src/service/devServerService';

describe('forceLightningLwcStop', () => {
  let sandbox: sinon.SinonSandbox;
  let devService: DevServerService;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    devService = new DevServerService();
    sandbox.stub(DevServerService, 'instance').get(() => devService);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls stopServer when a server is already running', async () => {
    const stopStub = sinon.stub();
    devService.registerServerHandler({
      stop: stopStub
    });

    await forceLightningLwcStop();
    sinon.assert.calledOnce(stopStub);
  });
});
