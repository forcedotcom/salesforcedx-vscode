/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { assert, SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import { taskService } from '../../../../src/testSupport/testRunner/taskService';
import { nls } from '../../../../src/messages';
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode/out/src/channels';

describe('Task Service Unit Tests', () => {
  let executeTaskStub: SinonStub<
    [vscode.Task],
    Thenable<vscode.TaskExecution | void>
  >;
  let onDidStartTaskStub: SinonStub<
    [
      (e: vscode.TaskStartEvent) => any,
      any?,
      (vscode.Disposable[] | undefined)?
    ],
    vscode.Disposable
  >;
  let onDidEndTaskStub: SinonStub<
    [(e: vscode.TaskEndEvent) => any, any?, (vscode.Disposable[] | undefined)?],
    vscode.Disposable
  >;
  let onDidStartTaskEmitter: vscode.EventEmitter<vscode.TaskStartEvent>;
  let onDidEndTaskEmitter: vscode.EventEmitter<vscode.TaskEndEvent>;
  let channelServiceAppendLineStub: SinonStub<any[], any>;
  let taskServiceRegistration: vscode.Disposable;
  beforeEach(() => {
    executeTaskStub = stub(vscode.tasks, 'executeTask');
    executeTaskStub.returns(Promise.resolve());
    onDidStartTaskEmitter = new vscode.EventEmitter<vscode.TaskStartEvent>();
    onDidEndTaskEmitter = new vscode.EventEmitter<vscode.TaskStartEvent>();
    onDidStartTaskStub = stub(vscode.tasks, 'onDidStartTask');
    onDidStartTaskStub.callsFake(onDidStartTaskEmitter.event);
    onDidEndTaskStub = stub(vscode.tasks, 'onDidEndTask');
    onDidEndTaskStub.callsFake(onDidEndTaskEmitter.event);
    channelServiceAppendLineStub = stub(
      ChannelService.prototype,
      'appendLine' as any
    );
    taskServiceRegistration = taskService.registerTaskService({} as any);
  });
  afterEach(() => {
    executeTaskStub.restore();
    onDidStartTaskEmitter.dispose();
    onDidEndTaskEmitter.dispose();
    onDidStartTaskStub.restore();
    onDidEndTaskStub.restore();
    channelServiceAppendLineStub.restore();
    taskServiceRegistration.dispose();
  });

  const mockVscodeTask: vscode.Task = {
    name: 'mockTaskName',
    source: 'SFDX',
    isBackground: false,
    presentationOptions: {
      clear: true
    },
    problemMatchers: [],
    runOptions: {},
    definition: {
      type: 'sfdxLwcTest'
    }
  };

  describe('Create Tasks', () => {
    it('Should output a message about default shell is cmd.exe in Windows', () => {
      const isWin32 = /^win32/.test(process.platform);
      const mockTaskId = 'mockTask1';
      const mockTaskName = 'mockTaskName';
      taskService.createTask(
        mockTaskId,
        mockTaskName,
        vscode.workspace.workspaceFolders![0],
        'mockCommand',
        []
      );
      if (isWin32) {
        assert.calledOnce(channelServiceAppendLineStub);
        assert.calledWith(
          channelServiceAppendLineStub,
          nls.localize('task_windows_command_prompt_messaging')
        );
      } else {
        assert.notCalled(channelServiceAppendLineStub);
      }
    });
  });

  describe('Notifies starts and end task events', () => {
    it('Should notify start task', async () => {
      const mockTaskId = 'mockTask1';
      const mockTaskName = 'mockTaskName';
      const sfdxTask = taskService.createTask(
        mockTaskId,
        mockTaskName,
        vscode.workspace.workspaceFolders![0],
        'mockCommand',
        []
      );
      return new Promise(async resolve => {
        sfdxTask.onDidStart(startedTask => {
          expect(startedTask).to.equal(sfdxTask);
          resolve();
        });
        await sfdxTask.execute();
        onDidStartTaskEmitter.fire({
          execution: {
            task: {
              ...mockVscodeTask,
              ...{ definition: { type: 'sfdxLwcTest', sfdxTaskId: mockTaskId } }
            },
            terminate: () => {}
          }
        });
      });
    });

    it('Should notify end task', async () => {
      const mockTaskId = 'mockTask2';
      const mockTaskName = 'mockTaskName';
      const sfdxTask = taskService.createTask(
        mockTaskId,
        mockTaskName,
        vscode.workspace.workspaceFolders![0],
        'mockCommand',
        []
      );
      return new Promise(async resolve => {
        sfdxTask.onDidEnd(endedTask => {
          expect(endedTask).to.equal(sfdxTask);
          resolve();
        });
        await sfdxTask.execute();
        onDidEndTaskEmitter.fire({
          execution: {
            task: {
              ...mockVscodeTask,
              ...{ definition: { type: 'sfdxLwcTest', sfdxTaskId: mockTaskId } }
            },
            terminate: () => {}
          }
        });
      });
    });

    it('Should dispose task on finishing execution', async () => {
      const mockTaskId = 'mockTask3';
      const mockTaskName = 'mockTaskName';
      const sfdxTask = taskService.createTask(
        mockTaskId,
        mockTaskName,
        vscode.workspace.workspaceFolders![0],
        'mockCommand',
        []
      );
      const disposeStub = stub(sfdxTask, 'dispose');
      return new Promise(async resolve => {
        sfdxTask.onDidEnd(endedTask => {
          expect(endedTask).to.equal(sfdxTask);
          process.nextTick(() => {
            assert.calledOnce(disposeStub);
            disposeStub.restore();
            resolve();
          });
        });
        await sfdxTask.execute();
        onDidEndTaskEmitter.fire({
          execution: {
            task: {
              ...mockVscodeTask,
              ...{ definition: { type: 'sfdxLwcTest', sfdxTaskId: mockTaskId } }
            },
            terminate: () => {}
          }
        });
      });
    });
  });
});
