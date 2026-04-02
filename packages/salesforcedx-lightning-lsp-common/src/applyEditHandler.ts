/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Handles workspace/applyEdit from the LWC or Aura language server by writing
 * file content via vscode.workspace.fs instead of applying edits in the IDE.
 * This avoids opening or focusing documents when the server creates/updates files
 * (e.g. create component, updateFileContent). Uses the same underlying API as
 * FsService in salesforcedx-vscode-services (workspace.fs), so behavior is
 * consistent with file:// and memfs:// workspaces.
 *
 * Used by both salesforcedx-vscode-lwc and salesforcedx-vscode-lightning (Aura).
 */
import { workspace } from 'vscode';
import {
  TextDocumentEdit as TDE,
  type ApplyWorkspaceEditParams,
  type ApplyWorkspaceEditResult,
  type TextDocumentEdit
} from 'vscode-languageserver-protocol';
import { URI, Utils } from 'vscode-uri';

export { ApplyWorkspaceEditRequest } from 'vscode-languageserver-protocol';

const isTextDocumentEdit = (change: unknown): change is TextDocumentEdit => TDE.is(change);

/**
 * Apply workspace edit by writing each changed document to the workspace via
 * workspace.fs (no editor open). Handles documentChanges: CreateFile + TextDocumentEdit
 * as produced by LspFileSystemAccessor.updateFileContent.
 */
export const handleApplyEditWithFs = async (params: ApplyWorkspaceEditParams): Promise<ApplyWorkspaceEditResult> => {
  const edit = params.edit;
  const documentChanges = edit.documentChanges;
  if (!documentChanges || documentChanges.length === 0) {
    return { applied: true };
  }

  try {
    for (const change of documentChanges) {
      if (isTextDocumentEdit(change)) {
        const uriStr = change.textDocument.uri;
        const edits = change.edits;
        if (edits.length === 0) continue;
        // Server sends a single insert at (0,0) with full content for create/write
        const content = edits.map(e => e.newText).join('');
        const vsUri = URI.parse(uriStr);
        const parentUri = Utils.joinPath(vsUri, '..');
        await workspace.fs.createDirectory(parentUri);
        await workspace.fs.writeFile(vsUri, new TextEncoder().encode(content));
      }
    }
    return { applied: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { applied: false, failureReason: message };
  }
};
