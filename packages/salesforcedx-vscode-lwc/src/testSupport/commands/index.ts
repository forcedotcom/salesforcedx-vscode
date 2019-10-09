import { commands, Disposable, ExtensionContext } from 'vscode';
import { forceLwcTestCaseDebug } from './forceLwcTestDebugAction';
import { forceLwcTestCaseRun } from './forceLwcTestRunAction';

export function registerCommands(
  extensionContext: ExtensionContext
): Disposable {
  const forceLwcTestCaseRunCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.case.run',
    forceLwcTestCaseRun
  );
  const forceLwcTestCaseDebugCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.case.debug',
    forceLwcTestCaseDebug
  );
  return Disposable.from(forceLwcTestCaseRunCmd, forceLwcTestCaseDebugCmd);
}
