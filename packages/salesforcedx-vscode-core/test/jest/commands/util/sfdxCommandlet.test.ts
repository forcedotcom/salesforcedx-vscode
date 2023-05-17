import { ChannelService } from '@salesforce/salesforcedx-utils-vscode/src/commands';
import { ForceSourcePullExecutor } from '../../../../src/commands';
import { CommandParams } from '../../../../src/commands/util';
import { CONTINUE } from '../../../../src/commands/util/parameterGatherers';
import { FORCE_SOURCE_PULL_LOG_NAME } from '../../../../src/constants';

describe('SfdxCommandletExecutor', () => {
  describe('execute', () => {
    it('should update the local cache for the components that were retrieved after a pull', () => {
      const flag = undefined;
      const pullCommand: CommandParams = {
        command: 'force:source:pull',
        description: {
          default: 'force_source_pull_default_org_text',
          forceoverwrite: 'force_source_pull_force_default_org_text'
        },
        logName: { default: FORCE_SOURCE_PULL_LOG_NAME }
      };
      const executor = new ForceSourcePullExecutor(flag, pullCommand);
      const updateCacheAfterPushPullMock = jest.spyOn(
        executor as any,
        'updateCache'
      );
      jest.spyOn(ChannelService.prototype, 'clear');

      // executor.execute({ type: 'CONTINUE', data: '' });
      // (executor as any).exitProcess('','','','','','');

      expect(updateCacheAfterPushPullMock).toHaveBeenCalled();
    });
  });
});
