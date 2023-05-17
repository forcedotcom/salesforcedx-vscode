import { ChannelService } from '@salesforce/salesforcedx-utils-vscode/src/commands';
import { ForceSourcePullExecutor } from '../../../src/commands';
import { CommandParams } from '../../../src/commands/util';

// jest.mock(
//   '@salesforce/salesforcedx-utils-vscode/src/commands/channelService.ts',
//   () => {
//     return {
//       ...jest.requireActual(
//         '@salesforce/salesforcedx-utils-vscode/src/commands/channelService.ts'
//       ),
//       clear: jest.fn()
//     };
//   }
// );

describe('BaseDeployExecutor', () => {
  describe('execute', () => {
    beforeEach(() => {
      jest.spyOn(ChannelService, 'getInstance').mockReturnValue({} as any);
      // jest.mock(ChannelService);
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
      const updateCacheAfterPushPullMock = jest.fn();
      (executor as any).updateCacheAfterPushPull = updateCacheAfterPushPullMock;
      (executor as any).attachExecution = jest.fn();

      executor.execute({ type: 'CONTINUE', data: '' });

      expect(updateCacheAfterPushPullMock).toHaveBeenCalled();
    });
  });
});
