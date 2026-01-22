/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

const SCHEME = 'sf-org-apex';

/** Lookup function for fetching Apex class body from org */
const lookupClassBody = (className: string): Effect.Effect<string, never, never> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const connectionService = yield* api.services.ConnectionService;
    const connection = yield* connectionService.getConnection;

    // Query for the Apex class body using Tooling API
    const query = `SELECT Id, Name, Body, NamespacePrefix FROM ApexClass WHERE Name = '${className.replaceAll("'", "''")}' LIMIT 1`;
    const result = yield* Effect.promise(() =>
      connection.tooling.query<{ Body: string; Name: string; NamespacePrefix?: string }>(query)
    );

    if (result.records.length === 0) {
      return `// Error: Class '${className}' not found in org`;
    }

    const apexClass = result.records[0];
    return apexClass.Body ?? `// Class '${className}' found but body is empty`;
  }).pipe(
    Effect.provide(AllServicesLayer),
    Effect.catchAll((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Effect.succeed(`// Error retrieving class '${className}' from org: ${errorMessage}`);
    })
  );

/** Create cache for Apex class bodies with 5 minute TTL */
const createClassBodyCache = (): Effect.Effect<Cache.Cache<string, string>, never, never> =>
  Cache.make({
    capacity: 1000,
    timeToLive: Duration.minutes(5),
    lookup: lookupClassBody
  });

let classBodyCache: Cache.Cache<string, string> | undefined;

/**
 * Virtual document provider for Apex classes that exist in the org but not locally.
 * This allows viewing org-only test classes in VS Code.
 */
class OrgApexClassProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this._onDidChange.event;

  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    // Extract class name from path, removing .cls extension if present
    let className = uri.path;
    if (!className) {
      return '// Error: Class name not found in URI';
    }
    // Remove .cls extension if present (added for syntax highlighting)
    if (className.endsWith('.cls')) {
      className = className.slice(0, -4);
    }

    // Ensure cache is initialized and get cached or fetch class body
    const cache = this.ensureCacheInitialized();
    return Effect.runPromise(cache.get(className));
  }

  private ensureCacheInitialized(): Cache.Cache<string, string> {
    classBodyCache ??= Effect.runSync(createClassBodyCache());
    return classBodyCache;
  }

  public invalidateCache(className: string): void {
    // Only invalidate if cache exists (nothing to invalidate if cache hasn't been used yet)
    if (classBodyCache) {
      Effect.runSync(classBodyCache.invalidate(className));
    }
    // Create URI with .cls extension for consistency
    const baseClassName = className.includes('.') ? className.split('.').pop()! : className;
    const uri = URI.parse(`${SCHEME}:${baseClassName}.cls`);
    this._onDidChange.fire(uri);
  }

  /** Clear all cached class bodies (call when org changes) */
  public clearAllCache(): void {
    const cache = this.ensureCacheInitialized();
    Effect.runSync(cache.invalidateAll);
  }

  /** Reset the cache completely (useful for testing) */
  public resetCache(): void {
    classBodyCache = undefined;
  }
}

let providerInstance: OrgApexClassProvider | undefined;

/**
 * Gets or creates the org Apex class provider instance
 */
export const getOrgApexClassProvider = (): OrgApexClassProvider => {
  providerInstance ??= new OrgApexClassProvider();
  return providerInstance;
};

/**
 * Creates a URI for an org-only Apex class
 * The URI format is: sf-org-apex:ClassName.cls
 * The .cls extension enables syntax highlighting from the LSP
 */
export const createOrgApexClassUri = (className: string): vscode.Uri => {
  // Extract base class name if it includes namespace (e.g., "ns.ClassName" -> "ClassName")
  const baseClassName = className.includes('.') ? className.split('.').pop()! : className;
  // Add .cls extension for syntax highlighting
  return URI.parse(`${SCHEME}:${baseClassName}.cls`);
};

/**
 * Opens an org-only Apex class in a virtual document
 */
export const openOrgApexClass = async (className: string, position?: vscode.Position): Promise<void> => {
  try {
    const uri = createOrgApexClassUri(className);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active
    });

    // Navigate to the specified position if provided
    if (position) {
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      nls.localize('apex_test_open_org_class_failed_message', className, errorMessage)
    );
  }
};
