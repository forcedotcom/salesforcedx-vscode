/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { DocumentContext } from '@salesforce/salesforcedx-visualforce-markup-language-server';
import {
  createConnection,
  Disposable,
  DocumentRangeFormattingRequest,
  DocumentSelector,
  IConnection,
  InitializeParams,
  InitializeResult,
  Position,
  RequestType,
  ServerCapabilities,
  TextDocumentPositionParams,
  TextDocuments
} from 'vscode-languageserver';
import {
  Diagnostic,
  DocumentLink,
  SymbolInformation,
  TextDocument
} from 'vscode-languageserver-types';
import {
  getLanguageModes,
  LanguageModes,
  Settings
} from './modes/languageModes';

import {
  ColorInformation,
  ColorPresentationRequest,
  DocumentColorRequest,
  ServerCapabilities as CPServerCapabilities
} from 'vscode-languageserver-protocol';
import {
  ConfigurationParams,
  ConfigurationRequest
} from 'vscode-languageserver-protocol';

import { format } from './modes/formatting';
import { pushAll } from './utils/arrays';

import * as path from 'path';
import * as url from 'url';
import uri from 'vscode-uri';

import * as nls from 'vscode-nls';
nls.config(process.env['VSCODE_NLS_CONFIG']);

// tslint:disable-next-line:no-namespace
namespace TagCloseRequest {
  export const type: RequestType<
    TextDocumentPositionParams,
    string,
    any,
    any
  > = new RequestType('html/tag');
}

// Create a connection for the server
const connection: IConnection = createConnection();

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

let workspacePath: string;
let languageModes: LanguageModes;

let clientSnippetSupport = false;
let clientDynamicRegisterSupport = false;
let scopedSettingsSupport = false;

let globalSettings: Settings = {};
let documentSettings: { [key: string]: Thenable<Settings> } = {};
// remove document settings on close
documents.onDidClose(e => {
  delete documentSettings[e.document.uri];
});

function getDocumentSettings(
  textDocument: TextDocument,
  needsDocumentSettings: () => boolean
): Thenable<Settings> {
  if (scopedSettingsSupport && needsDocumentSettings()) {
    let promise = documentSettings[textDocument.uri];
    if (!promise) {
      const scopeUri = textDocument.uri;
      const configRequestParam: ConfigurationParams = {
        items: [
          { scopeUri, section: 'css' },
          { scopeUri, section: 'visualforce' },
          { scopeUri, section: 'javascript' }
        ]
      };
      promise = connection
        .sendRequest(ConfigurationRequest.type, configRequestParam)
        .then(s => ({ css: s[0], visualforce: s[1], javascript: s[2] }));
      documentSettings[textDocument.uri] = promise;
    }
    return promise;
  }
  return Promise.resolve(void 0);
}

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites
connection.onInitialize(
  (params: InitializeParams): InitializeResult => {
    const initializationOptions = params.initializationOptions;

    workspacePath = params.rootPath;

    languageModes = getLanguageModes(
      initializationOptions
        ? initializationOptions.embeddedLanguages
        : { css: true, javascript: true }
    );
    documents.onDidClose(e => {
      languageModes.onDocumentRemoved(e.document);
    });
    connection.onShutdown(() => {
      languageModes.dispose();
    });

    function hasClientCapability(...keys: string[]) {
      let c = params.capabilities;
      for (let i = 0; c && i < keys.length; i++) {
        c = c[keys[i]];
      }
      return !!c;
    }

    clientSnippetSupport = hasClientCapability(
      'textDocument',
      'completion',
      'completionItem',
      'snippetSupport'
    );
    clientDynamicRegisterSupport = hasClientCapability(
      'workspace',
      'symbol',
      'dynamicRegistration'
    );
    scopedSettingsSupport = hasClientCapability('workspace', 'configuration');
    const capabilities: ServerCapabilities & CPServerCapabilities = {
      // Tell the client that the server works in FULL text document sync mode
      textDocumentSync: documents.syncKind,
      completionProvider: clientSnippetSupport
        ? {
            resolveProvider: true,
            triggerCharacters: ['.', ':', '<', '"', '=', '/', '>']
          }
        : null,
      hoverProvider: true,
      documentHighlightProvider: true,
      documentRangeFormattingProvider: false,
      documentLinkProvider: { resolveProvider: false },
      documentSymbolProvider: true,
      definitionProvider: true,
      signatureHelpProvider: { triggerCharacters: ['('] },
      referencesProvider: true,
      colorProvider: true
    };

    return { capabilities };
  }
);

let formatterRegistration: Thenable<Disposable> = null;

// The settings have changed. Is send on server activation as well.
connection.onDidChangeConfiguration(change => {
  globalSettings = change.settings;

  documentSettings = {}; // reset all document settings
  languageModes.getAllModes().forEach(m => {
    if (m.configure) {
      m.configure(change.settings);
    }
  });
  documents.all().forEach(triggerValidation);

  // dynamically enable & disable the formatter
  if (clientDynamicRegisterSupport) {
    const enableFormatter =
      globalSettings &&
      globalSettings.visualforce &&
      globalSettings.visualforce.format &&
      globalSettings.visualforce.format.enable;
    if (enableFormatter) {
      if (!formatterRegistration) {
        const documentSelector: DocumentSelector = [
          { language: 'visualforce', scheme: 'file' }
        ];
        formatterRegistration = connection.client.register(
          DocumentRangeFormattingRequest.type,
          { documentSelector }
        );
      }
    } else if (formatterRegistration) {
      formatterRegistration.then(r => r.dispose());
      formatterRegistration = null;
    }
  }
});

const pendingValidationRequests: { [uri: string]: NodeJS.Timer } = {};
const validationDelayMs = 200;

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  triggerValidation(change.document);
});

// a document has closed: clear all diagnostics
documents.onDidClose(event => {
  cleanPendingValidation(event.document);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

function cleanPendingValidation(textDocument: TextDocument): void {
  const request = pendingValidationRequests[textDocument.uri];
  if (request) {
    clearTimeout(request);
    delete pendingValidationRequests[textDocument.uri];
  }
}

function triggerValidation(textDocument: TextDocument): void {
  cleanPendingValidation(textDocument);
  pendingValidationRequests[textDocument.uri] = setTimeout(() => {
    delete pendingValidationRequests[textDocument.uri];
    // tslint:disable-next-line:no-floating-promises
    validateTextDocument(textDocument);
  }, validationDelayMs);
}

function isValidationEnabled(
  languageId: string,
  settings: Settings = globalSettings
) {
  const validationSettings =
    settings && settings.visualforce && settings.visualforce.validate;
  if (validationSettings) {
    return (
      (languageId === 'css' && validationSettings.styles !== false) ||
      (languageId === 'javascript' && validationSettings.scripts !== false)
    );
  }
  return true;
}

async function validateTextDocument(textDocument: TextDocument) {
  const diagnostics: Diagnostic[] = [];
  if (textDocument.languageId === 'html') {
    const modes = languageModes.getAllModesInDocument(textDocument);
    const settings = await getDocumentSettings(textDocument, () =>
      modes.some(m => !!m.doValidation)
    );
    modes.forEach(mode => {
      if (mode.doValidation && isValidationEnabled(mode.getId(), settings)) {
        pushAll(diagnostics, mode.doValidation(textDocument, settings));
      }
    });
  }
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCompletion(async textDocumentPosition => {
  const document = documents.get(textDocumentPosition.textDocument.uri);
  const mode = languageModes.getModeAtPosition(
    document,
    textDocumentPosition.position
  );
  if (mode && mode.doComplete) {
    if (mode.getId() !== 'html') {
      connection.telemetry.logEvent({
        key: 'html.embbedded.complete',
        value: { languageId: mode.getId() }
      });
    }
    const settings = await getDocumentSettings(
      document,
      () => mode.doComplete.length > 2
    );
    return mode.doComplete(document, textDocumentPosition.position, settings);
  }
  return { isIncomplete: true, items: [] };
});

connection.onCompletionResolve(item => {
  const data = item.data;
  if (data && data.languageId && data.uri) {
    const mode = languageModes.getMode(data.languageId);
    const document = documents.get(data.uri);
    if (mode && mode.doResolve && document) {
      return mode.doResolve(document, item);
    }
  }
  return item;
});

connection.onHover(textDocumentPosition => {
  const document = documents.get(textDocumentPosition.textDocument.uri);
  const mode = languageModes.getModeAtPosition(
    document,
    textDocumentPosition.position
  );
  if (mode && mode.doHover) {
    return mode.doHover(document, textDocumentPosition.position);
  }
  return null;
});

connection.onDocumentHighlight(documentHighlightParams => {
  const document = documents.get(documentHighlightParams.textDocument.uri);
  const mode = languageModes.getModeAtPosition(
    document,
    documentHighlightParams.position
  );
  if (mode && mode.findDocumentHighlight) {
    return mode.findDocumentHighlight(
      document,
      documentHighlightParams.position
    );
  }
  return [];
});

connection.onDefinition(definitionParams => {
  const document = documents.get(definitionParams.textDocument.uri);
  const mode = languageModes.getModeAtPosition(
    document,
    definitionParams.position
  );
  if (mode && mode.findDefinition) {
    return mode.findDefinition(document, definitionParams.position);
  }
  return [];
});

connection.onReferences(referenceParams => {
  const document = documents.get(referenceParams.textDocument.uri);
  const mode = languageModes.getModeAtPosition(
    document,
    referenceParams.position
  );
  if (mode && mode.findReferences) {
    return mode.findReferences(document, referenceParams.position);
  }
  return [];
});

connection.onSignatureHelp(signatureHelpParms => {
  const document = documents.get(signatureHelpParms.textDocument.uri);
  const mode = languageModes.getModeAtPosition(
    document,
    signatureHelpParms.position
  );
  if (mode && mode.doSignatureHelp) {
    return mode.doSignatureHelp(document, signatureHelpParms.position);
  }
  return null;
});

connection.onDocumentRangeFormatting(async formatParams => {
  const document = documents.get(formatParams.textDocument.uri);
  let settings = await getDocumentSettings(document, () => true);
  if (!settings) {
    settings = globalSettings;
  }
  const unformattedTags: string =
    (settings &&
      settings.visualforce &&
      settings.visualforce.format &&
      settings.visualforce.format.unformatted) ||
    '';
  const enabledModes = {
    css: !unformattedTags.match(/\bstyle\b/),
    javascript: !unformattedTags.match(/\bscript\b/)
  };

  return format(
    languageModes,
    document,
    formatParams.range,
    formatParams.options,
    settings,
    enabledModes
  );
});

connection.onDocumentLinks(documentLinkParam => {
  const document = documents.get(documentLinkParam.textDocument.uri);
  const documentContext: DocumentContext = {
    resolveReference: (ref, base) => {
      if (base) {
        ref = url.resolve(base, ref);
      }
      if (workspacePath && ref[0] === '/') {
        return uri.file(path.join(workspacePath, ref)).toString();
      }
      return url.resolve(document.uri, ref);
    }
  };
  const links: DocumentLink[] = [];
  languageModes.getAllModesInDocument(document).forEach(m => {
    if (m.findDocumentLinks) {
      pushAll(links, m.findDocumentLinks(document, documentContext));
    }
  });
  return links;
});

connection.onDocumentSymbol(documentSymbolParms => {
  const document = documents.get(documentSymbolParms.textDocument.uri);
  const symbols: SymbolInformation[] = [];
  languageModes.getAllModesInDocument(document).forEach(m => {
    if (m.findDocumentSymbols) {
      pushAll(symbols, m.findDocumentSymbols(document));
    }
  });
  return symbols;
});

connection.onRequest(DocumentColorRequest.type, params => {
  const infos: ColorInformation[] = [];
  const document = documents.get(params.textDocument.uri);
  if (document) {
    languageModes.getAllModesInDocument(document).forEach(m => {
      if (m.findDocumentColors) {
        pushAll(infos, m.findDocumentColors(document));
      }
    });
  }
  return infos;
});

connection.onRequest(ColorPresentationRequest.type, params => {
  const document = documents.get(params.textDocument.uri);
  if (document) {
    const mode = languageModes.getModeAtPosition(document, params.range.start);
    if (mode && mode.getColorPresentations) {
      return mode.getColorPresentations(document, params as ColorInformation);
    }
  }
  return [];
});

connection.onRequest(TagCloseRequest.type, params => {
  const document = documents.get(params.textDocument.uri);
  if (document) {
    const pos = params.position;
    if (pos.character > 0) {
      const mode = languageModes.getModeAtPosition(
        document,
        Position.create(pos.line, pos.character - 1)
      );
      if (mode && mode.doAutoClose) {
        return mode.doAutoClose(document, pos);
      }
    }
  }
  return null;
});

// Listen on the connection
connection.listen();
