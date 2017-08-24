'use strict';

import {
  CompletionItem,
  CompletionItemKind,
  Command,
  CodeActionRequest,
  CodeActionParams,
  CodeActionContext,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  IConnection,
  InitializeParams,
  InitializeResult,
  IPCMessageReader,
  IPCMessageWriter,
  TextDocument,
  TextEdit,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind
} from 'vscode-languageserver';

import * as vscode from 'vscode';

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
      // Tell the client that the server support code complete
      completionProvider: {
        resolveProvider: true
      },
      codeActionProvider: true
    }
  };
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

// The settings interface describe the server relevant settings part
interface Settings {
  languageServerExample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(change => {
  // const settings = <Settings>change.settings;
  // maxNumberOfProblems =
  //   settings.languageServerExample.maxNumberOfProblems || 100;
  // Revalidate any open text documents
  documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {
  const diagnostics: Diagnostic[] = [];
  const lines = textDocument.getText().split(/\r?\n/g);
  let problems = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const found = line.match(/slds\S*--[A-Za-z0-9_-]+/) || [];
    const index = found.index || -1;

    if (index >= 0) {
      const foundStringLength = found[0].length;
      const fixedString = found[0].replace('--', '_');
      problems++;
      diagnostics.push({
        code: 0,
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: index },
          end: { line: i, character: index + foundStringLength }
        },
        message: `Deprecated SLDS class name (v2.3.1): ${line.substr(
          index,
          foundStringLength
        )} should be ${fixedString}`,
        source: `${fixedString}`
      });
    }
  }
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

}

connection.onCodeAction((params) => {
  const uri = params.textDocument;
  const range = params.range;
  const diagnostics = params.context.diagnostics;
  let result: Command[] = [];
  const documentVersion: number = -1;

  for (let i = 0; i < diagnostics.length; i++) {
    let diagnostic = diagnostics[i];

    let code = diagnostic.code;

    switch (code) {
      case 0: {
        result.push(
          Command.create('Fix: Deprecated SLDS class name',
            'deprecatedClassName', uri, documentVersion, {
              range: diagnostic.range,
              newText: diagnostic.source
            })
        );
      }
    }
  }

  return result;
}
);

connection.onDidChangeWatchedFiles(change => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
      {
        label: 'TypeScript',
        kind: CompletionItemKind.Text,
        data: 1
      },
      {
        label: 'JavaScript',
        kind: CompletionItemKind.Text,
        data: 2
      }
    ];
  }
);

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data === 1) {
    (item.detail = 'TypeScript details'), (item.documentation =
      'TypeScript documentation');
  } else if (item.data === 2) {
    (item.detail = 'JavaScript details'), (item.documentation =
      'JavaScript documentation');
  }
  return item;
});

let t: Thenable<string>;

/*
connection.onDidOpenTextDocument((params) => {
  // A text document got opened in VSCode.
  // params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
  // params.textDocument.text the initial full content of the document.
  connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
  // The content of a text document did change in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // params.contentChanges describe the content changes to the document.
  connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
  // A text document got closed in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();
