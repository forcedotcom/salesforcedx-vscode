import { ExtensionContext } from 'vscode';
import { registerLwcTestCodeLensProvider } from './codeLens/lwcTestCodeLensProvider';
import { registerCommands } from './commands';

export function activateLwcTestSupport(context: ExtensionContext) {
  registerCommands(context);
  registerLwcTestCodeLensProvider(context);
}
