/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { channelService } from '../../channel';
import { nls } from '../../messages';

interface SfdxTaskDefinition extends vscode.TaskDefinition {
  sfdxTaskId: string;
}

/**
 * A wrapper over vscode.Task that emits events during task lifecycle
 */
export class SfdxTask {
  private task: vscode.Task;
  private taskExecution?: vscode.TaskExecution;
  public onDidStart: vscode.Event<SfdxTask>;
  public onDidEnd: vscode.Event<SfdxTask>;

  private onDidStartEventEmitter: vscode.EventEmitter<SfdxTask>;
  private onDidEndEventEmitter: vscode.EventEmitter<SfdxTask>;
  constructor(task: vscode.Task) {
    this.task = task;
    this.onDidStartEventEmitter = new vscode.EventEmitter<SfdxTask>();
    this.onDidEndEventEmitter = new vscode.EventEmitter<SfdxTask>();
    this.onDidStart = this.onDidStartEventEmitter.event;
    this.onDidEnd = this.onDidEndEventEmitter.event;
  }

  public notifyStartTask() {
    this.onDidStartEventEmitter.fire(this);
  }

  public notifyEndTask() {
    this.onDidEndEventEmitter.fire(this);
  }

  public async execute() {
    this.taskExecution = await vscode.tasks.executeTask(this.task);
    return this;
  }

  public terminate() {
    if (this.taskExecution) {
      this.taskExecution.terminate();
    }
    this.dispose();
  }

  public dispose() {
    this.onDidStartEventEmitter.dispose();
    this.onDidEndEventEmitter.dispose();
  }
}

/**
 * Task service for creating vscode.Task
 */
class TaskService {
  private createdTasks: Map<string, SfdxTask>;

  constructor() {
    this.createdTasks = new Map();
  }

  /**
   * Register task service with extension context
   * @param extensionContext extension context
   */
  public registerTaskService(extensionContext: vscode.ExtensionContext) {
    const handleDidStartTask = vscode.tasks.onDidStartTask(
      taskStartEvent => {
        const { execution } = taskStartEvent;
        const { definition } = execution.task;
        const { sfdxTaskId } = definition;
        if (sfdxTaskId) {
          const foundTask = this.createdTasks.get(sfdxTaskId);
          if (foundTask) {
            foundTask.notifyStartTask();
          }
        }
      },
      null,
      extensionContext.subscriptions
    );

    const handleDidEndTask = vscode.tasks.onDidEndTask(
      taskEndEvent => {
        const { execution } = taskEndEvent;
        const { definition } = execution.task;
        const { sfdxTaskId } = definition;
        if (sfdxTaskId) {
          const foundTask = this.createdTasks.get(sfdxTaskId);
          if (foundTask) {
            foundTask.notifyEndTask();
            this.createdTasks.delete(sfdxTaskId);
            foundTask.dispose();
          }
        }
      },
      null,
      extensionContext.subscriptions
    );
    return vscode.Disposable.from(handleDidStartTask, handleDidEndTask);
  }

  /**
   * Create a vscode.Task instance
   * @param taskId a unique task id
   * @param taskName localized task name
   * @param taskScope task scope
   * @param cmd command line executable
   * @param args command line arguments
   */
  public createTask(
    taskId: string,
    taskName: string,
    taskScope: vscode.WorkspaceFolder | vscode.TaskScope,
    cmd: string,
    args: Array<string | vscode.ShellQuotedString>
  ): SfdxTask {
    const taskDefinition: SfdxTaskDefinition = {
      type: 'sfdxLwcTest',
      sfdxTaskId: taskId
    };
    const taskSource = 'SFDX';
    // https://github.com/forcedotcom/salesforcedx-vscode/issues/2097
    // Git Bash shell doesn't handle command paths correctly.
    // Always launch with command prompt (cmd.exe) in Windows.
    const isWin32 = /^win32/.test(process.platform);
    let taskShellExecutionOptions: vscode.ShellExecutionOptions | undefined;
    if (isWin32) {
      channelService.appendLine(
        nls.localize('task_windows_command_prompt_messaging')
      );
      taskShellExecutionOptions = {
        executable: 'cmd.exe',
        shellArgs: ['/d', '/c']
      };
    }
    const taskShellExecution = new vscode.ShellExecution(
      cmd,
      args,
      taskShellExecutionOptions
    );
    const task = new vscode.Task(
      taskDefinition,
      taskScope,
      taskName,
      taskSource,
      taskShellExecution
    );
    task.presentationOptions.clear = true;

    const sfdxTask = new SfdxTask(task);
    this.createdTasks.set(taskId, sfdxTask);
    return sfdxTask;
  }
}
export const taskService = new TaskService();
