/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext } from 'vscode';
import { registerLwcTestCodeLensProvider } from './codeLens/lwcTestCodeLensProvider';
import { registerCommands } from './commands';
import { registerLwcTestExplorerTreeView } from './testExplorer/testOutlineProvider';
import { lwcTestIndexer } from './testIndexer';

export function activateLwcTestSupport(context: ExtensionContext) {
  registerCommands(context);
  registerLwcTestCodeLensProvider(context);
  registerLwcTestExplorerTreeView(context);
  // It's actually a synchronous function to start file watcher.
  // Finding test files will only happen when going into test explorer
  // Parsing test files will happen when expanding on the test group nodesk,
  // or open a test file, or on watched files change
  lwcTestIndexer.configureAndIndex().catch(error => console.error(error));
}
