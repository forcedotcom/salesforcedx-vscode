import * as vscode from 'vscode';
import { channelService } from '../../src/channels';
import * as orphanHandler from '../../src/languageServerOrphanHandler';
import { ProcessDetail } from '../../src/languageUtils';
import * as languageServerUtils from '../../src/languageUtils/languageServerUtils';
import { nls } from '../../src/messages';

describe('languageServerOrphanHandler', () => {
  beforeEach(() => {
    jest
      .spyOn(channelService, 'showChannelOutput')
      .mockImplementation(jest.fn());
    jest
      .spyOn(channelService, 'appendLine')
      .mockImplementation(jest.fn());
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveAnyFoundOrphanLanguageServers', () => {
    it('should call findAndCheckOrphanedProcesses and terminateProcess', async () => {
      const orphanedProcesses: ProcessDetail[] = [
        {
          pid: 123,
          ppid: 456,
          command: 'test',
          orphaned: true
        }
      ];

      jest.spyOn(channelService, 'appendLine');

      jest.spyOn(orphanHandler, 'getResolutionForOrphanProcesses').mockResolvedValueOnce(true);

      const findAndCheckOrphanedProcessesSpy = jest.spyOn(
        languageServerUtils,
        'findAndCheckOrphanedProcesses'
      ).mockReturnValueOnce(orphanedProcesses);

      const terminateProcessSpy = jest.spyOn(languageServerUtils, 'terminateProcess');

      await orphanHandler.resolveAnyFoundOrphanLanguageServers();

      expect(findAndCheckOrphanedProcessesSpy).toHaveBeenCalledTimes(1);
      expect(terminateProcessSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getResolutionForOrphanProcesses', () => {
    it('should return true if user selects to terminate processes', async () => {
      const orphanedProcesses: ProcessDetail[] = [
        {
          pid: 123,
          ppid: 456,
          command: 'test',
          orphaned: true
        }
      ];
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValueOnce(Promise.resolve(orphanHandler.TERMINATE_PROCESSES_BTN as any));
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValueOnce(Promise.resolve(orphanHandler.YES as any));

      const result = await orphanHandler.getResolutionForOrphanProcesses(orphanedProcesses);

      expect(result).toBe(true);
    });

    it('should return false if user selects to show processes', async () => {
      const orphanedProcesses: ProcessDetail[] = [
        {
          pid: 123,
          ppid: 456,
          command: 'test',
          orphaned: true
        }
      ];
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValueOnce(Promise.resolve(orphanHandler.SHOW_PROCESSES_BTN as any));

      const result = await orphanHandler.getResolutionForOrphanProcesses(orphanedProcesses);

      expect(result).toBe(false);
    });
  });

  describe('showOrphansInChannel', () => {
    it('should call channelService.appendLine for each orphaned process', () => {
      const orphanedProcesses: ProcessDetail[] = [
        {
          pid: 123,
          ppid: 456,
          command: 'test',
          orphaned: true
        },
        {
          pid: 789,
          ppid: 101,
          command: 'test2',
          orphaned: true
        }
      ];
      const appendLineSpy = jest.spyOn(channelService, 'appendLine');

      orphanHandler.showOrphansInChannel(orphanedProcesses);

      expect(appendLineSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('terminationConfirmation', () => {
    it('should return true if user confirms termination', async () => {
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValueOnce(Promise.resolve(orphanHandler.YES as any));

      const result = await orphanHandler.terminationConfirmation(1);

      expect(result).toBe(true);
    });

    it('should return false if user cancels termination', async () => {
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValueOnce(Promise.resolve(orphanHandler.CANCEL as any));

      const result = await orphanHandler.terminationConfirmation(1);

      expect(result).toBe(false);
    });
  });

  describe('requestsTermination', () => {
    it('should return true if choice is TERMINATE_PROCESSES_BTN', () => {
      const result = orphanHandler.requestsTermination(orphanHandler.TERMINATE_PROCESSES_BTN);

      expect(result).toBe(true);
    });

    it('should return false if choice is undefined', () => {
      const result = orphanHandler.requestsTermination(undefined);

      expect(result).toBe(false);
    });

    it('should return false if choice is not TERMINATE_PROCESSES_BTN', () => {
      const result = orphanHandler.requestsTermination(orphanHandler.SHOW_PROCESSES_BTN);

      expect(result).toBe(false);
    });
  });

  describe('showProcesses', () => {
    it('should call showOrphansInChannel if choice is "terminate_show_processes"', () => {
      jest.spyOn(orphanHandler, 'showProcesses').mockImplementationOnce(() => true);
      const orphanedProcesses: ProcessDetail[] = [
        {
          pid: 123,
          ppid: 456,
          command: 'test',
          orphaned: true
        },
        {
          pid: 789,
          ppid: 101,
          command: 'test2',
          orphaned: true
        }
      ];

      const appendLineSpy = jest.spyOn(channelService, 'appendLine');

      orphanHandler.showOrphansInChannel(orphanedProcesses);

      expect(appendLineSpy).toHaveBeenCalledTimes(3);

    });

    it('should not call showOrphansInChannel if choice is not "terminate_show_processes"', async () => {
      jest.spyOn(orphanHandler, 'showProcesses').mockImplementationOnce(() => false);
      const orphanedProcesses: ProcessDetail[] = [
        {
          pid: 123,
          ppid: 456,
          command: 'test',
          orphaned: true
        },
        {
          pid: 789,
          ppid: 101,
          command: 'test2',
          orphaned: true
        }
      ];

      const appendLineSpy = jest.spyOn(channelService, 'appendLine');

      await orphanHandler.getResolutionForOrphanProcesses(orphanedProcesses);

      expect(appendLineSpy).toHaveBeenCalledTimes(0);

    });
  });

  describe('showProcessTerminated', () => {
    it('should call channelService.appendLine with the correct message', () => {
      const processDetail: ProcessDetail = {
        pid: 123,
        ppid: 456,
        command: 'test',
        orphaned: true
      };
      const appendLineSpy = jest.spyOn(channelService, 'appendLine');

      orphanHandler.showProcessTerminated(processDetail);

      expect(appendLineSpy).toHaveBeenCalledTimes(1);
      expect(appendLineSpy).toHaveBeenCalledWith(nls.localize(orphanHandler.TERMINATED_PROCESS, processDetail.pid));
    });
  });

  describe('showTerminationFailed', () => {
    it('should call channelService.appendLine with the correct message', () => {
      const processDetail: ProcessDetail = {
        pid: 123,
        ppid: 456,
        command: 'test',
        orphaned: true
      };
      const err = new Error('test error');
      const appendLineSpy = jest.spyOn(channelService, 'appendLine');

      orphanHandler.showTerminationFailed(processDetail, err);

      expect(appendLineSpy).toHaveBeenCalledTimes(1);
      expect(appendLineSpy).toHaveBeenCalledWith(
        nls.localize(orphanHandler.TERMINATE_FAILED, processDetail.pid, err.message)
      );
    });
  });
});
