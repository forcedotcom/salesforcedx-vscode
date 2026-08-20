/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isString } from 'effect/Predicate';
import * as vscode from 'vscode';
import { appendToChannel } from '../../channel';
import { nls } from '../../messages';
import { JestPseudoterminal } from './jestPseudoterminal';

type SfTaskDefinition = vscode.TaskDefinition & {
  sfTaskId: string;
};

/**
 * A wrapper over vscode.Task that emits events during task lifecycle
 */
export class SfTask {
  private task: vscode.Task;
  private taskId: string;
  /**
   * The vscode.TaskExecution for this task, set after execute() resolves.
   * Use to correlate with task process events (e.g., onDidEndTaskProcess).
   */
  public taskExecution?: vscode.TaskExecution;
  /**
   * The pseudoterminal instance (when using CustomExecution).
   * Provides access to captured output for error reporting.
   */
  public pseudoterminal?: JestPseudoterminal;
  public onDidStart: vscode.Event<SfTask>;
  public onDidEnd: vscode.Event<SfTask>;

  private onDidStartEventEmitter: vscode.EventEmitter<SfTask>;
  private onDidEndEventEmitter: vscode.EventEmitter<SfTask>;
  constructor(task: vscode.Task, taskId: string, pseudoterminal?: JestPseudoterminal) {
    this.task = task;
    this.taskId = taskId;
    this.pseudoterminal = pseudoterminal;
    this.onDidStartEventEmitter = new vscode.EventEmitter<SfTask>();
    this.onDidEndEventEmitter = new vscode.EventEmitter<SfTask>();
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

  /**
   * Correlates a VS Code task execution without relying on execute() having resolved.
   */
  public matchesExecution(execution: vscode.TaskExecution): boolean {
    const { definition } = execution.task;
    const executionTaskId = isString(definition.sfTaskId) ? definition.sfTaskId : undefined;
    return this.taskId === executionTaskId;
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
  private createdTasks: Map<string, SfTask>;

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
        const sfTaskId = isString(definition.sfTaskId) ? definition.sfTaskId : undefined;
        if (sfTaskId) {
          const foundTask = this.createdTasks.get(sfTaskId);
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
        const sfTaskId = isString(definition.sfTaskId) ? definition.sfTaskId : undefined;
        if (sfTaskId) {
          const foundTask = this.createdTasks.get(sfTaskId);
          if (foundTask) {
            foundTask.notifyEndTask();
            this.createdTasks.delete(sfTaskId);
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
    args: (string | vscode.ShellQuotedString)[]
  ): SfTask {
    const taskDefinition: SfTaskDefinition = {
      type: 'sfLwcTest',
      sfTaskId: taskId
    };
    const taskSource = 'SFDX';

    // Convert args to plain strings for pseudoterminal
    const stringArgs = args.map(arg => (typeof arg === 'string' ? arg : arg.value));

    const cwd = typeof taskScope === 'object' && 'uri' in taskScope ? taskScope.uri.fsPath : process.cwd();

    // https://github.com/forcedotcom/salesforcedx-vscode/issues/2097
    // Git Bash shell doesn't handle command paths correctly.
    // Always launch with command prompt (cmd.exe) in Windows.
    const isWin32 = process.platform.startsWith('win32');
    let shellOptions: { executable: string; shellArgs: string[] } | undefined;
    if (isWin32) {
      appendToChannel(nls.localize('task_windows_command_prompt_messaging'));
      shellOptions = {
        executable: 'cmd.exe',
        shellArgs: ['/d', '/c']
      };
    }

    // Create pseudoterminal to capture output
    const pseudoterminal = new JestPseudoterminal(cmd, stringArgs, {
      cwd,
      shellOptions
    });

    // Use CustomExecution to run our pseudoterminal
    const taskExecution = new vscode.CustomExecution(() => Promise.resolve(pseudoterminal));
    const task = new vscode.Task(taskDefinition, taskScope, taskName, taskSource, taskExecution);

    // Task presentation: shared panel hidden from user (results surface in Test Results tab).
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Never,
      focus: false,
      echo: false,
      panel: vscode.TaskPanelKind.Shared,
      clear: true,
      showReuseMessage: false
    };

    const sfTask = new SfTask(task, taskId, pseudoterminal);
    this.createdTasks.set(taskId, sfTask);
    return sfTask;
  }
}
export const taskService = new TaskService();
