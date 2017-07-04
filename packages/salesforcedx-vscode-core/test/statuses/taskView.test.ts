// tslint:disable:no-unused-expression

import { stub } from 'sinon';
import { expect } from 'chai';
import { CancellationTokenSource } from 'vscode';
import {
  SfdxCommandBuilder,
  CliCommandExecutor
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { Task, TaskViewService } from '../../src/statuses/taskView';
import { localize } from '../../src/messages';

describe('Task View', () => {
  describe('Task View Provider', () => {
    let taskViewService: TaskViewService;

    beforeEach(() => {
      taskViewService = new TaskViewService();
    });

    it('Should add a command to its internal queue', () => {
      taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute()
      );

      expect(taskViewService.getChildren()).to.have.lengthOf(1);
      expect(taskViewService.getChildren()[0].label).to.be.equal(
        localize('task_view_running_message', 'sfdx force --help')
      );
    });

    it('Should fire an event when a command is added', async () => {
      taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute()
      );

      const event = await new Promise((resolve, reject) => {
        taskViewService.onDidChangeTreeData(e => {
          resolve(e);
        });
      });

      // Expect that we see an event but the payload of the event is undefined
      // to signal that the root has changed
      expect(event).to.be.undefined;
    });

    it('Should remove a command from its internal queue when present', () => {
      const task = taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute()
      );

      taskViewService.removeTask(task);

      expect(taskViewService.getChildren()).to.have.lengthOf(0);
    });

    it('Should not remove a command from its internal queue when not present', () => {
      taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute()
      );
      taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute()
      );
      const bogusTask = new Task(taskViewService, stub() as any);

      const wasRemoved = taskViewService.removeTask(bogusTask);
      expect(wasRemoved).to.be.false;

      expect(taskViewService.getChildren()).to.have.lengthOf(2);
    });

    it('Should terminate and remove specific task if provided', () => {
      const tokenSource = new CancellationTokenSource();
      const task = taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute(tokenSource.token),
        tokenSource
      );

      expect(taskViewService.getChildren()).to.have.lengthOf(1);

      taskViewService.terminateTask(task);

      expect(taskViewService.getChildren()).to.have.lengthOf(0);
    });

    it('Should terminate LRU task if no specific task provided', () => {
      taskViewService.addCommandExecution(
        new CliCommandExecutor(
          new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
          {}
        ).execute()
      );

      expect(taskViewService.getChildren()).to.have.lengthOf(1);

      taskViewService.terminateTask();

      expect(taskViewService.getChildren()).to.have.lengthOf(0);
    });
  });

  describe('Task', () => {
    it('Should remove itself from Task View once terminated', async () => {
      const taskViewService = new TaskViewService();
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
        {}
      ).execute();
      taskViewService.addCommandExecution(execution);

      expect(taskViewService.getChildren()).to.have.lengthOf(1);

      await new Promise((resolve, reject) => {
        taskViewService.onDidChangeTreeData(e => {
          resolve(e);
        });
      });

      expect(taskViewService.getChildren()).to.have.lengthOf(0);
    });
  });
});
