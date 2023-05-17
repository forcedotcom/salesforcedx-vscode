import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import { ForceSourcePullExecutor } from '../../../src/commands';
import { CommandParams } from '../../../src/commands/util';
import { channelService } from '../../../src/channels';
import { nls } from '../../../src/messages';

// jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
//   return {
//     ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
//     ChannelService: { clear: jest.fn() }
//   };
// });

jest.mock('../../../src/channels');
jest.mock('../../../src/statuses');

describe('BaseDeployExecutor', () => {
  describe('execute', () => {
    beforeEach(() => {
      jest.spyOn(ChannelService, 'getInstance').mockReturnValue({} as any);
      // jest.mock(ChannelService);
      jest.spyOn(nls, 'localize').mockReturnValue('');
    });
    it('should update the local cache for the components that were deployed after a push', () => {
      const pushCommand: CommandParams = {
        command: 'force:source:push',
        description: {
          default: 'force_source_push_default_org_text',
          forceoverwrite: 'force_source_push_force_default_org_text'
        },
        logName: { default: 'force_source_push_default_scratch_org' }
      };
      const flag = '';
      const executor = new ForceSourcePullExecutor(flag, pushCommand);
      const updateCacheMock = jest.fn();
      (executor as any).updateCache = updateCacheMock;
      // jest.mock('../../../src/channels');
      // jest.spyOn(ChannelService).mockImplementation();

      // Commenting the below out causes the err with Channel Service
      // (executor as any).attachExecution = jest.fn();

      executor.execute({ type: 'CONTINUE', data: '' });

      expect(updateCacheMock).toHaveBeenCalled();
    });
  });
});
