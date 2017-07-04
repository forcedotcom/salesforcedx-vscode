import { Task, taskViewService } from '../statuses';

export function forceTaskStop(task: Task) {
  if (task instanceof Task) {
    // See https://github.com/Microsoft/vscode-docs/blob/master/docs/extensionAPI/extension-points.md#contributesmenus
    // For best case inference efforts on what to pass in
    taskViewService.terminateTask(task);
  } else {
    taskViewService.terminateTask();
  }
}
