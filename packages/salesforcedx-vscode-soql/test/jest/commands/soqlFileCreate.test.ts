/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('../../../src/messages', () => ({
  nls: {
    localize: (key: string) => key
  }
}));

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { soqlOpenNew } from '../../../src/commands/soqlFileCreate';
import { BUILDER_VIEW_TYPE, OPEN_WITH_COMMAND } from '../../../src/constants';

const UNTITLED_URI_STRING = 'untitled:untitled.soql';

const makeDoc = (isDirty: boolean, text = ''): vscode.TextDocument =>
  ({
    uri: { toString: () => UNTITLED_URI_STRING } as vscode.Uri,
    isDirty,
    lineCount: text.split('\n').length,
    getText: () => text
  }) as unknown as vscode.TextDocument;

describe('soqlOpenNew', () => {
  let executeCommandMock: jest.Mock;
  let showWarningMessageMock: jest.Mock;
  let workspaceSaveMock: jest.Mock;
  let applyEditMock: jest.Mock;
  let mockReplace: jest.Mock;

  beforeEach(() => {
    mockReplace = jest.fn();
    (vscode.WorkspaceEdit as jest.Mock) = jest.fn().mockImplementation(() => ({ replace: mockReplace }));
    executeCommandMock = (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
    showWarningMessageMock = (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
    workspaceSaveMock = jest.fn().mockResolvedValue({ toString: () => '/saved/untitled.soql' });
    applyEditMock = jest.fn().mockResolvedValue(true);
    Object.defineProperty(vscode.workspace, 'save', { value: workspaceSaveMock, configurable: true });
    Object.defineProperty(vscode.workspace, 'applyEdit', { value: applyEditMock, configurable: true });
    Object.defineProperty(vscode.workspace, 'textDocuments', { value: [], configurable: true, writable: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens a new query when no existing document is open', async () => {
    await Effect.runPromise(soqlOpenNew());

    expect(showWarningMessageMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith(OPEN_WITH_COMMAND, expect.anything(), BUILDER_VIEW_TYPE);
  });

  it('opens a new query when existing document is not dirty and has no content', async () => {
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [makeDoc(false, '')],
      configurable: true
    });

    await Effect.runPromise(soqlOpenNew());

    expect(showWarningMessageMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith(OPEN_WITH_COMMAND, expect.anything(), BUILDER_VIEW_TYPE);
  });

  it('shows a modal warning when an existing document has unsaved changes', async () => {
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [makeDoc(true, 'SELECT Id FROM Account')],
      configurable: true
    });

    await Effect.runPromise(soqlOpenNew());

    expect(showWarningMessageMock).toHaveBeenCalledWith(
      'soql_open_new_unsaved_warning',
      { modal: true, detail: 'soql_open_new_unsaved_detail' },
      'soql_open_new_unsaved_save',
      'soql_open_new_unsaved_dont_save'
    );
  });

  it('shows a modal warning when a document has content but is not dirty (malformed SOQL)', async () => {
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [makeDoc(false, 'SELECT FROM Account')],
      configurable: true
    });

    await Effect.runPromise(soqlOpenNew());

    expect(showWarningMessageMock).toHaveBeenCalledWith(
      'soql_open_new_unsaved_warning',
      { modal: true, detail: 'soql_open_new_unsaved_detail' },
      'soql_open_new_unsaved_save',
      'soql_open_new_unsaved_dont_save'
    );
  });

  it('saves the document and opens a new query when user clicks Save', async () => {
    const doc = makeDoc(true, 'SELECT Id FROM Account');
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [doc],
      configurable: true
    });
    showWarningMessageMock.mockResolvedValue('soql_open_new_unsaved_save');

    await Effect.runPromise(soqlOpenNew());

    expect(workspaceSaveMock).toHaveBeenCalledWith(doc.uri);
    expect(executeCommandMock).toHaveBeenCalledWith(OPEN_WITH_COMMAND, expect.anything(), BUILDER_VIEW_TYPE);
  });

  it('aborts when user clicks Save but the Save As dialog is cancelled', async () => {
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [makeDoc(true, 'SELECT Id FROM Account')],
      configurable: true
    });
    showWarningMessageMock.mockResolvedValue('soql_open_new_unsaved_save');
    workspaceSaveMock.mockResolvedValue(undefined);

    await Effect.runPromise(soqlOpenNew());

    expect(executeCommandMock).not.toHaveBeenCalled();
  });

  it("clears the document and opens a new query when user clicks Don't Save", async () => {
    const doc = makeDoc(true, 'SELECT Id FROM Account');
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [doc],
      configurable: true
    });
    showWarningMessageMock.mockResolvedValue('soql_open_new_unsaved_dont_save');

    await Effect.runPromise(soqlOpenNew());

    expect(workspaceSaveMock).not.toHaveBeenCalled();
    expect(applyEditMock).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(doc.uri, expect.anything(), '');
    expect(executeCommandMock).toHaveBeenCalledWith(OPEN_WITH_COMMAND, expect.anything(), BUILDER_VIEW_TYPE);
  });

  it('aborts when user dismisses the warning dialog', async () => {
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [makeDoc(true, 'SELECT Id FROM Account')],
      configurable: true
    });
    showWarningMessageMock.mockResolvedValue(undefined);

    await Effect.runPromise(soqlOpenNew());

    expect(workspaceSaveMock).not.toHaveBeenCalled();
    expect(executeCommandMock).not.toHaveBeenCalled();
  });
});
