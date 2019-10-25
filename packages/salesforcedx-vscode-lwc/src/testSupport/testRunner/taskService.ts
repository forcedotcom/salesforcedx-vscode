/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

interface SfdxTaskDefinition extends vscode.TaskDefinition {
  sfdxTaskId: string;
}

// A wrapper over vscode.Task that emit event during task lifecycle
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
    this.taskExecution!.terminate();
    this.dispose();
  }

  public dispose() {
    this.onDidStartEventEmitter.dispose();
    this.onDidEndEventEmitter.dispose();
  }
}

class TaskService {
  private createdTasks: Map<string, SfdxTask>;

  constructor() {
    this.createdTasks = new Map();
  }

  public registerTaskService(context: vscode.ExtensionContext) {
    vscode.tasks.onDidStartTask(
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
      context.subscriptions
    );

    vscode.tasks.onDidEndTask(
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
      context.subscriptions
    );
  }

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
    const taskShellExecution = new vscode.ShellExecution(cmd, args);
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
