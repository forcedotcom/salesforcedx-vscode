/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { retrieveOrgBrowserTreeItemCommand } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';
import { FilterStateService } from './services/filterStateService';
import { FilePresenceService } from './tree/filePresenceService';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const coreConfig = vscode.workspace.getConfiguration('salesforcedx-vscode-core');
  const useLegacyOrgBrowser = coreConfig.get<boolean>('useLegacyOrgBrowser', false);

  if (useLegacyOrgBrowser) {
    console.log('Salesforce Org Browser extension disabled via setting (legacy org browser enabled)');
    return;
  }

  return Effect.runPromise(
    Effect.provide(activateEffect(context), AllServicesLayer) as Effect.Effect<void, Error, never>
  );
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(Effect.provide(deactivateEffect, AllServicesLayer) as Effect.Effect<void | undefined, Error, never>);

// export for testing
export const activateEffect = (context: vscode.ExtensionContext) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const svc = yield* api.services.ChannelService;
    yield* svc.appendToChannel('Salesforce Org Browser extension activating');

    // Start the file presence worker for background file checks
    const filePresenceService = yield* FilePresenceService;
    context.subscriptions.push(filePresenceService.start());

    // Initialize filter state service with workspace persistence
    const filterService = new FilterStateService(context.workspaceState);
    yield* Effect.promise(() => filterService.initializeContextKeys());

    const treeProvider = new MetadataTypeTreeProvider();
    treeProvider.setFilterService(filterService);

    // Register the tree view with dynamic description for org context
    const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
      treeDataProvider: treeProvider,
      showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Update message based on filter state
    const updateTreeMessage = (): void => {
      const state = filterService.getState();
      const messages: string[] = [];

      if (state.searchQuery) {
        messages.push(`Searching: "${state.searchQuery}"`);
      }
      if (state.showLocalOnly) {
        messages.push('Local files only');
      }
      if (state.hideManaged) {
        messages.push('Hiding managed packages');
      }

      treeView.message = messages.length > 0 ? messages.join(' | ') : undefined;
    };

    // Show initial filter state on activation
    updateTreeMessage();

    // Subscribe to filter state changes to refresh tree
    context.subscriptions.push(
      filterService.onChange(state => {
        treeProvider.updateFilterState(state);
        updateTreeMessage();
        treeProvider.fireChangeEvent();
      })
    );

    // Show progress in tree view message when checking local files
    filePresenceService.setProgressCallback(busy => {
      if (busy) {
        treeView.message = 'Checking local files...';
      } else {
        // Restore filter message when done
        updateTreeMessage();
      }
    });

    // Update count badges when file presence checks complete for a batch
    filePresenceService.setBatchCompleteCallback(batchId => {
      treeProvider.updateNodeCounts(batchId);
      treeProvider.fireChangeEvent();
    });

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.refreshType`, async (node: OrgBrowserTreeItem) => {
        await treeProvider.refreshType(node);
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.retrieveMetadata`, async (node: OrgBrowserTreeItem | undefined, ...args: unknown[]) => {
        // VS Code should pass the tree item when clicking inline action buttons
        // But if it's not provided, try fallbacks:
        if (!node) {
          // First try: get from selection
          const selection = treeView.selection;
          if (selection.length > 0) {
            node = selection[0] as OrgBrowserTreeItem;
          } else {
            // Second try: if args[0] is a string (ID), try to find it in cache
            if (args.length > 0 && typeof args[0] === 'string') {
              const foundNode = treeProvider.findTreeItemById(args[0]);
              if (foundNode) {
                node = foundNode;
              }
            }
          }
        }
        await retrieveOrgBrowserTreeItemCommand(node, treeProvider);
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.toggleLocalOnly`, async () => {
        await filterService.toggleShowLocalOnly();
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.toggleLocalOnlyOff`, async () => {
        await filterService.toggleShowLocalOnly();
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.toggleHideManaged`, async () => {
        await filterService.toggleHideManaged();
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.toggleHideManagedOff`, async () => {
        await filterService.toggleHideManaged();
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.search`, async () => {
        const query = await vscode.window.showInputBox({
          prompt: 'Search metadata (use Type:Name for structured search, e.g., CustomObject:Broker)',
          placeHolder: 'Search...',
          value: filterService.getState().searchQuery
        });
        if (query !== undefined) {
          await filterService.setSearchQuery(query);
        }
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.clearSearch`, async () => {
        await filterService.clearSearch();
      })
    );

    let previousOrgId: string | undefined;

    yield* Effect.forkDaemon(
      api.services.TargetOrgRef.changes.pipe(
        Stream.runForEach(org =>
          Effect.gen(function* () {
            const currentOrgId = org.orgId ?? org.username;
            // Refresh when org actually changes (including from undefined to new org)
            const orgChanged = currentOrgId !== previousOrgId;

            yield* svc.appendToChannel(`Target org changed to ${JSON.stringify(org)}`);

            if (orgChanged) {
              // Cancel all pending file presence checks - they're now stale
              filePresenceService.cancelAllBatches();

              // Clear all caches when org changes - data from previous org is invalid
              // This ensures expanded nodes (like ApexClass) don't show stale data from previous org
              treeProvider.setOrgId(currentOrgId);

              // Collapse all nodes so expanded nodes from previous org don't appear expanded
              // when the new org has no children for that type
              yield* Effect.promise(() =>
                vscode.commands.executeCommand(`workbench.actions.treeView.${TREE_VIEW_ID}.collapseAll`)
              );

              // Fire change event for entire tree to force VS Code to refresh all expanded nodes
              treeProvider.fireChangeEvent();

              if (currentOrgId) {
                // Use alias first (if present), then username, then orgId for display
                // This matches the default org status bar item behavior
                const displayName = org.alias ?? org.username ?? currentOrgId;

                // Update tree view description to show current org
                treeView.description = displayName;

                // Refresh root to fetch new org's metadata types
                yield* Effect.promise(() => treeProvider.refreshType());
              } else {
                // Org cleared - update description and refresh tree
                treeView.description = 'No org connected';
                yield* Effect.promise(() => treeProvider.refreshType());
              }
            }

            previousOrgId = currentOrgId;
          }).pipe(Effect.provide(AllServicesLayer))
        )
      )
    );

    // Append completion message
    yield* svc.appendToChannel('Salesforce Org Browser activation complete.');
  }).pipe(Effect.withSpan(`activation:${EXTENSION_NAME}`));

export const deactivateEffect = ExtensionProviderService.pipe(
  Effect.flatMap(svcProvider => svcProvider.getServicesApi),
  Effect.flatMap(api => api.services.ChannelService),
  Effect.flatMap(svc => svc.appendToChannel('Salesforce Org Browser extension is now deactivated!')),
  Effect.withSpan(`deactivation:${EXTENSION_NAME}`),
  Effect.provide(AllServicesLayer)
);
