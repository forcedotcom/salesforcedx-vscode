/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';

const SCHEME = 'sf-org-apex';
const CLASS_BODY_CACHE = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    // Check cache first
    const cached = CLASS_BODY_CACHE.get(className);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.content;
    }

    try {
      const core = await getVscodeCoreExtension();
      const connection = await core.exports.services.WorkspaceContext.getInstance().getConnection();

      // Query for the Apex class body using Tooling API
      const query = `SELECT Id, Name, Body, NamespacePrefix FROM ApexClass WHERE Name = '${className.replaceAll("'", "''")}' LIMIT 1`;
      const result = await connection.tooling.query<{ Body: string; Name: string; NamespacePrefix?: string }>(query);

      if (result.records.length === 0) {
        return `// Error: Class '${className}' not found in org`;
      }

      const apexClass = result.records[0];
      const content = apexClass.Body || `// Class '${className}' found but body is empty`;

      // Cache the content
      CLASS_BODY_CACHE.set(className, { content, timestamp: Date.now() });

      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `// Error retrieving class '${className}' from org: ${errorMessage}`;
    }
  }

  public invalidateCache(className: string): void {
    CLASS_BODY_CACHE.delete(className);
    // Create URI with .cls extension for consistency
    const baseClassName = className.includes('.') ? className.split('.').pop()! : className;
    const uri = vscode.Uri.parse(`${SCHEME}:${baseClassName}.cls`);
    this._onDidChange.fire(uri);
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
  return vscode.Uri.parse(`${SCHEME}:${baseClassName}.cls`);
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
