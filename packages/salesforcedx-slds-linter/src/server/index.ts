'use strict';

import {
  Command,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  IConnection,
  InitializeResult,
  IPCMessageReader,
  IPCMessageWriter,
  TextDocument,
  TextDocuments,
  TextEdit
} from 'vscode-languageserver';

import { nls } from '../messages';

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
let workspaceRoot: string | undefined | null;
connection.onInitialize((params): InitializeResult => {
  workspaceRoot = params.rootPath;
  return {
    capabilities: {
      // Tell the client that the server works in FULL text document sync mode
      textDocumentSync: documents.syncKind,
      codeActionProvider: true
    }
  };
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

documents.onDidOpen(change => {
  validateTextDocument(change.document);
});

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(change => {
  // Revalidate any open text documents
  documents.all().forEach(validateTextDocument);
});

let activeDiagnostics: Diagnostic[] = [];

function validateTextDocument(textDocument: TextDocument): void {
  activeDiagnostics = [];
  const lines = textDocument.getText().split(/\r?\n/g);
  let problems = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const found = line.match(/slds\S*--[A-Za-z0-9_-]+/g) || [];
    for (const match of found) {
      const index = line.search(match) || -1;

      if (index >= 0) {
        const foundStringLength = match.length;
        const fixedString = match.replace('--', '_');
        problems++;
        const diagnostic = <Diagnostic>{
          code: `0${fixedString}`,
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: i, character: index },
            end: { line: i, character: index + foundStringLength }
          },
          message: nls.localize('deprecated_class_name', line.substr(
            index,
            foundStringLength
          ), fixedString),
          source: 'slds'
        };
        activeDiagnostics.push(diagnostic);
      }
    }
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({
    uri: textDocument.uri,
    diagnostics: activeDiagnostics
  });
}

connection.onCodeAction(params => {
  const uri = params.textDocument.uri;
  const diagnostics = params.context.diagnostics;
  const result: Command[] = [];
  const edits: TextEdit[] = [];
  let code = '';

  for (const diagnostic of diagnostics) {
    const codeStr = <string>diagnostic.code;
    code = codeStr[0];
    const replacementStr = codeStr.slice(1);

    switch (code) {
      case '0': {
        edits.push({
          range: diagnostic.range,
          newText: replacementStr
        });

        result.push(
          Command.create(
            nls.localize('fix_problem', diagnostic.message),
            'deprecatedClassName',
            uri,
            edits
          )
        );
      }
    }
  }

  sameCodeActions(result, uri, code);
  allCodeActions(result, uri);

  return result;
});

function allCodeActions(result: Command[], uri: string) {
  const fixAllEdits: TextEdit[] = [];

  if (activeDiagnostics.length > 1) {
    for (const codeAction of activeDiagnostics) {
      const codeStr = <string>codeAction.code;
      const replacementStr = codeStr.slice(1);
      fixAllEdits.push({
        range: codeAction.range,
        newText: replacementStr
      });
    }
    result.push(
      Command.create(
        nls.localize('fix_all'),
        'deprecatedClassName',
        uri,
        fixAllEdits
      )
    );
  }
}

function sameCodeActions(result: Command[], uri: string, problem: string) {
  const fixSameEdits: TextEdit[] = [];
  let codeMessage;

  if (activeDiagnostics.length > 1) {
    for (const codeAction of activeDiagnostics) {
      const code = <string>codeAction.code;
      if (code[0] === problem) {
        const codeStr = <string>codeAction.code;
        const replacementStr = codeStr.slice(1);
        fixSameEdits.push({
          range: codeAction.range,
          newText: replacementStr
        });

        switch (problem) {
          case '0': {
            codeMessage = nls.localize('general_deprecated_class_name');
            break;
          }
          default: {
            codeMessage = 'same problems';
          }
        }

      }
    }
    result.push(
      Command.create(
        nls.localize('fix_same', codeMessage),
        'deprecatedClassName',
        uri,
        fixSameEdits
      )
    );
  }
}

connection.onDidChangeWatchedFiles(change => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// Listen on the connection
connection.listen();
