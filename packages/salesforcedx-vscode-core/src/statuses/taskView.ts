/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode';
import {
  CancellationTokenSource,
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState
} from 'vscode';
import { nls } from '../messages';

export class TaskViewService implements TreeDataProvider<Task> {
  private static instance: TaskViewService;
  private readonly tasks: Task[];
  private _onDidChangeTreeData: EventEmitter<Task | undefined> = new EventEmitter<Task | undefined>();

  public readonly onDidChangeTreeData: Event<Task | undefined> = this._onDidChangeTreeData.event;

  public constructor() {
    this.tasks = [];
  }

  public static getInstance() {
    if (!TaskViewService.instance) {
      TaskViewService.instance = new TaskViewService();
    }
    return TaskViewService.instance;
  }

  public addCommandExecution(execution: CommandExecution, cancellationTokenSource?: CancellationTokenSource): Task {
    const task = new Task(this, execution, cancellationTokenSource);
    task.monitor();
    this.tasks.push(task);

    this._onDidChangeTreeData.fire(undefined);
    return task;
  }

  public removeTask(task: Task): boolean {
    const index = this.tasks.indexOf(task);
    if (index !== -1) {
      this.tasks.splice(index, 1);

      this._onDidChangeTreeData.fire(undefined);
      return true;
    }
    return false;
  }

  public terminateTask(task?: Task) {
    if (task) {
      if (task.cancel()) {
        this.removeTask(task);
      }
    } else {
      const lru = this.tasks.pop();
      if (lru) {
        this.removeTask(lru);
      }
    }
  }

  public getTreeItem(element: Task): TreeItem {
    return element;
  }

  public getChildren(element?: Task): Task[] {
    if (!element) {
      // This is the root node
      return this.tasks;
    }

    return [];
  }
}

export class Task extends TreeItem {
  public readonly label?: string;
  public readonly collapsibleState?: TreeItemCollapsibleState;
  private readonly taskViewProvider: TaskViewService;
  private readonly execution: CommandExecution;
  private readonly cancellationTokenSource?: CancellationTokenSource;

  constructor(
    taskViewProvider: TaskViewService,
    execution: CommandExecution,
    cancellationTokenSource?: CancellationTokenSource
  ) {
    super(nls.localize('task_view_running_message', execution.command), TreeItemCollapsibleState.None);

    this.taskViewProvider = taskViewProvider;
    this.execution = execution;
    this.cancellationTokenSource = cancellationTokenSource;
  }

  public monitor() {
    this.execution.processExitSubject.subscribe(() => {
      this.taskViewProvider.removeTask(this);
    });
    this.execution.processErrorSubject.subscribe(() => {
      this.taskViewProvider.removeTask(this);
    });
  }

  public cancel(): boolean {
    if (this.cancellationTokenSource) {
      this.cancellationTokenSource.cancel();
      return true;
    } else {
      return false;
    }
  }
}
