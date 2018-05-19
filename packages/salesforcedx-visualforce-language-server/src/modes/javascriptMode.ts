/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  Definition,
  Diagnostic,
  DiagnosticSeverity,
  DocumentHighlight,
  DocumentHighlightKind,
  FormattingOptions,
  Hover,
  Location,
  MarkedString,
  ParameterInformation,
  Position,
  Range,
  SignatureHelp,
  SignatureInformation,
  SymbolInformation,
  SymbolKind,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import {
  getLanguageModelCache,
  LanguageModelCache
} from '../languageModelCache';
import {
  getWordAtText,
  isWhitespaceOnly,
  repeat,
  startsWith
} from '../utils/strings';
import { HTMLDocumentRegions } from './embeddedSupport';
import { LanguageMode, Settings } from './languageModes';

import * as ts from 'typescript';

const FILE_NAME = 'vscode://javascript/1'; // the same 'file' is used for all contents
const JS_WORD_REGEX = /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g;

export function getJavascriptMode(
  documentRegions: LanguageModelCache<HTMLDocumentRegions>
): LanguageMode {
  const jsDocuments = getLanguageModelCache<TextDocument>(10, 60, document =>
    documentRegions.get(document).getEmbeddedDocument('javascript')
  );

  const compilerOptions: ts.CompilerOptions = {
    allowNonTsExtensions: true,
    allowJs: true,
    lib: ['lib.es6.d.ts'],
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.Classic
  };
  let currentTextDocument: TextDocument;
  let scriptFileVersion = 0;
  function updateCurrentTextDocument(doc: TextDocument) {
    if (
      !currentTextDocument ||
      doc.uri !== currentTextDocument.uri ||
      doc.version !== currentTextDocument.version
    ) {
      currentTextDocument = jsDocuments.get(doc);
      scriptFileVersion++;
    }
  }
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [FILE_NAME],
    getScriptKind: () => ts.ScriptKind.JS,
    getScriptVersion: (fileName: string) => {
      if (fileName === FILE_NAME) {
        return String(scriptFileVersion);
      }
      return '1';
    },
    getScriptSnapshot: (fileName: string) => {
      let text = '';
      if (startsWith(fileName, 'vscode:')) {
        if (fileName === FILE_NAME) {
          text = currentTextDocument.getText();
        }
      } else {
        text = ts.sys.readFile(fileName) || '';
      }
      return {
        getText: (start, end) => text.substring(start, end),
        getLength: () => text.length,
        getChangeRange: () => void 0
      };
    },
    getCurrentDirectory: () => '',
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options)
  };
  const jsLanguageService = ts.createLanguageService(host);

  let globalSettings: Settings = {};

  return {
    getId() {
      return 'javascript';
    },
    configure(options: any) {
      globalSettings = options;
    },
    doValidation(document: TextDocument): Diagnostic[] {
      updateCurrentTextDocument(document);
      const syntaxDiagnostics = jsLanguageService.getSyntacticDiagnostics(
        FILE_NAME
      );
      const semanticDiagnostics = jsLanguageService.getSemanticDiagnostics(
        FILE_NAME
      );
      return syntaxDiagnostics
        .concat(semanticDiagnostics)
        .map((diag): Diagnostic => {
          return {
            range: convertRange(currentTextDocument, diag),
            severity: DiagnosticSeverity.Error,
            message: ts.flattenDiagnosticMessageText(diag.messageText, '\n')
          };
        });
    },
    doComplete(document: TextDocument, position: Position): CompletionList {
      updateCurrentTextDocument(document);
      const offset = currentTextDocument.offsetAt(position);
      const completions = jsLanguageService.getCompletionsAtPosition(
        FILE_NAME,
        offset,
        { includeExternalModuleExports: false }
      );
      if (!completions) {
        return { isIncomplete: false, items: [] };
      }
      const replaceRange = convertRange(
        currentTextDocument,
        getWordAtText(currentTextDocument.getText(), offset, JS_WORD_REGEX)
      );
      return {
        isIncomplete: false,
        items: completions.entries.map(entry => {
          return {
            uri: document.uri,
            position,
            label: entry.name,
            sortText: entry.sortText,
            kind: convertKind(entry.kind),
            textEdit: TextEdit.replace(replaceRange, entry.name),
            data: {
              // data used for resolving item details (see 'doResolve')
              languageId: 'javascript',
              uri: document.uri,
              offset
            }
          };
        })
      };
    },
    doResolve(document: TextDocument, item: CompletionItem): CompletionItem {
      updateCurrentTextDocument(document);
      const details = jsLanguageService.getCompletionEntryDetails(
        FILE_NAME,
        item.data.offset,
        item.label,
        undefined,
        undefined
      );
      if (details) {
        item.detail = ts.displayPartsToString(details.displayParts);
        item.documentation = ts.displayPartsToString(details.documentation);
        delete item.data;
      }
      return item;
    },
    doHover(document: TextDocument, position: Position): Hover {
      updateCurrentTextDocument(document);
      const info = jsLanguageService.getQuickInfoAtPosition(
        FILE_NAME,
        currentTextDocument.offsetAt(position)
      );
      if (info) {
        const contents = ts.displayPartsToString(info.displayParts);
        return {
          range: convertRange(currentTextDocument, info.textSpan),
          contents: MarkedString.fromPlainText(contents)
        };
      }
      return null;
    },
    doSignatureHelp(document: TextDocument, position: Position): SignatureHelp {
      updateCurrentTextDocument(document);
      const signHelp = jsLanguageService.getSignatureHelpItems(
        FILE_NAME,
        currentTextDocument.offsetAt(position)
      );
      if (signHelp) {
        const ret: SignatureHelp = {
          activeSignature: signHelp.selectedItemIndex,
          activeParameter: signHelp.argumentIndex,
          signatures: []
        };
        signHelp.items.forEach(item => {
          const signature: SignatureInformation = {
            label: '',
            documentation: null,
            parameters: []
          };

          signature.label += ts.displayPartsToString(item.prefixDisplayParts);
          item.parameters.forEach((p, i, a) => {
            const label = ts.displayPartsToString(p.displayParts);
            const parameter: ParameterInformation = {
              label,
              documentation: ts.displayPartsToString(p.documentation)
            };
            signature.label += label;
            signature.parameters.push(parameter);
            if (i < a.length - 1) {
              signature.label += ts.displayPartsToString(
                item.separatorDisplayParts
              );
            }
          });
          signature.label += ts.displayPartsToString(item.suffixDisplayParts);
          ret.signatures.push(signature);
        });
        return ret;
      }
      return null;
    },
    findDocumentHighlight(
      document: TextDocument,
      position: Position
    ): DocumentHighlight[] {
      updateCurrentTextDocument(document);
      const occurrences = jsLanguageService.getOccurrencesAtPosition(
        FILE_NAME,
        currentTextDocument.offsetAt(position)
      );
      if (occurrences) {
        return occurrences.map(entry => {
          return {
            range: convertRange(currentTextDocument, entry.textSpan),
            kind: (entry.isWriteAccess
              ? DocumentHighlightKind.Write
              : DocumentHighlightKind.Text) as DocumentHighlightKind
          };
        });
      }
      return null;
    },
    findDocumentSymbols(document: TextDocument): SymbolInformation[] {
      updateCurrentTextDocument(document);
      const items = jsLanguageService.getNavigationBarItems(FILE_NAME);
      if (items) {
        const result: SymbolInformation[] = [];
        const existing = {};
        const collectSymbols = (
          item: ts.NavigationBarItem,
          containerLabel?: string
        ) => {
          const sig = item.text + item.kind + item.spans[0].start;
          if (item.kind !== 'script' && !existing[sig]) {
            const symbol: SymbolInformation = {
              name: item.text,
              kind: convertSymbolKind(item.kind),
              location: {
                uri: document.uri,
                range: convertRange(currentTextDocument, item.spans[0])
              },
              containerName: containerLabel
            };
            existing[sig] = true;
            result.push(symbol);
            containerLabel = item.text;
          }

          if (item.childItems && item.childItems.length > 0) {
            for (const child of item.childItems) {
              collectSymbols(child, containerLabel);
            }
          }
        };

        items.forEach(item => collectSymbols(item));
        return result;
      }
      return null;
    },
    findDefinition(document: TextDocument, position: Position): Definition {
      updateCurrentTextDocument(document);
      const definition = jsLanguageService.getDefinitionAtPosition(
        FILE_NAME,
        currentTextDocument.offsetAt(position)
      );
      if (definition) {
        return definition.filter(d => d.fileName === FILE_NAME).map(d => {
          return {
            uri: document.uri,
            range: convertRange(currentTextDocument, d.textSpan)
          };
        });
      }
      return null;
    },
    findReferences(document: TextDocument, position: Position): Location[] {
      updateCurrentTextDocument(document);
      const references = jsLanguageService.getReferencesAtPosition(
        FILE_NAME,
        currentTextDocument.offsetAt(position)
      );
      if (references) {
        return references.filter(d => d.fileName === FILE_NAME).map(d => {
          return {
            uri: document.uri,
            range: convertRange(currentTextDocument, d.textSpan)
          };
        });
      }
      return null;
    },
    format(
      document: TextDocument,
      range: Range,
      formatParams: FormattingOptions,
      settings: Settings = globalSettings
    ): TextEdit[] {
      currentTextDocument = documentRegions
        .get(document)
        .getEmbeddedDocument('javascript', true);
      scriptFileVersion++;

      const formatterSettings =
        settings && settings.javascript && settings.javascript.format;

      const initialIndentLevel = computeInitialIndent(
        document,
        range,
        formatParams
      );
      const formatSettings = convertOptions(
        formatParams,
        formatterSettings,
        initialIndentLevel + 1
      );
      const start = currentTextDocument.offsetAt(range.start);
      let end = currentTextDocument.offsetAt(range.end);
      let lastLineRange = null;
      if (
        range.end.character === 0 ||
        isWhitespaceOnly(
          currentTextDocument
            .getText()
            .substr(end - range.end.character, range.end.character)
        )
      ) {
        end -= range.end.character;
        lastLineRange = Range.create(
          Position.create(range.end.line, 0),
          range.end
        );
      }
      const edits = jsLanguageService.getFormattingEditsForRange(
        FILE_NAME,
        start,
        end,
        formatSettings
      );
      if (edits) {
        const result = [];
        for (const edit of edits) {
          if (
            edit.span.start >= start &&
            edit.span.start + edit.span.length <= end
          ) {
            result.push({
              range: convertRange(currentTextDocument, edit.span),
              newText: edit.newText
            });
          }
        }
        if (lastLineRange) {
          result.push({
            range: lastLineRange,
            newText: generateIndent(initialIndentLevel, formatParams)
          });
        }
        return result;
      }
      return null;
    },
    onDocumentRemoved(document: TextDocument) {
      jsDocuments.onDocumentRemoved(document);
    },
    dispose() {
      jsLanguageService.dispose();
      jsDocuments.dispose();
    }
  };
}

function convertRange(
  document: TextDocument,
  span: { start: number; length: number }
): Range {
  const startPosition = document.positionAt(span.start);
  const endPosition = document.positionAt(span.start + span.length);
  return Range.create(startPosition, endPosition);
}

function convertKind(kind: string): CompletionItemKind {
  switch (kind) {
    case 'primitive type':
    case 'keyword':
      return CompletionItemKind.Keyword;
    case 'var':
    case 'local var':
      return CompletionItemKind.Variable;
    case 'property':
    case 'getter':
    case 'setter':
      return CompletionItemKind.Field;
    case 'function':
    case 'method':
    case 'construct':
    case 'call':
    case 'index':
      return CompletionItemKind.Function;
    case 'enum':
      return CompletionItemKind.Enum;
    case 'module':
      return CompletionItemKind.Module;
    case 'class':
      return CompletionItemKind.Class;
    case 'interface':
      return CompletionItemKind.Interface;
    case 'warning':
      return CompletionItemKind.File;
  }

  return CompletionItemKind.Property;
}

function convertSymbolKind(kind: string): SymbolKind {
  switch (kind) {
    case 'var':
    case 'local var':
    case 'const':
      return SymbolKind.Variable;
    case 'function':
    case 'local function':
      return SymbolKind.Function;
    case 'enum':
      return SymbolKind.Enum;
    case 'module':
      return SymbolKind.Module;
    case 'class':
      return SymbolKind.Class;
    case 'interface':
      return SymbolKind.Interface;
    case 'method':
      return SymbolKind.Method;
    case 'property':
    case 'getter':
    case 'setter':
      return SymbolKind.Property;
  }
  return SymbolKind.Variable;
}

function convertOptions(
  options: FormattingOptions,
  formatSettings: any,
  initialIndentLevel: number
): ts.FormatCodeOptions {
  return {
    ConvertTabsToSpaces: options.insertSpaces,
    TabSize: options.tabSize,
    IndentSize: options.tabSize,
    IndentStyle: ts.IndentStyle.Smart,
    NewLineCharacter: '\n',
    BaseIndentSize: options.tabSize * initialIndentLevel,
    InsertSpaceAfterCommaDelimiter: Boolean(
      !formatSettings || formatSettings.insertSpaceAfterCommaDelimiter
    ),
    InsertSpaceAfterSemicolonInForStatements: Boolean(
      !formatSettings || formatSettings.insertSpaceAfterSemicolonInForStatements
    ),
    InsertSpaceBeforeAndAfterBinaryOperators: Boolean(
      !formatSettings || formatSettings.insertSpaceBeforeAndAfterBinaryOperators
    ),
    InsertSpaceAfterKeywordsInControlFlowStatements: Boolean(
      !formatSettings ||
        formatSettings.insertSpaceAfterKeywordsInControlFlowStatements
    ),
    InsertSpaceAfterFunctionKeywordForAnonymousFunctions: Boolean(
      !formatSettings ||
        formatSettings.insertSpaceAfterFunctionKeywordForAnonymousFunctions
    ),
    InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: Boolean(
      formatSettings &&
        formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis
    ),
    InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: Boolean(
      formatSettings &&
        formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets
    ),
    InsertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: Boolean(
      formatSettings &&
        formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces
    ),
    InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: Boolean(
      formatSettings &&
        formatSettings.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces
    ),
    PlaceOpenBraceOnNewLineForControlBlocks: Boolean(
      formatSettings && formatSettings.placeOpenBraceOnNewLineForFunctions
    ),
    PlaceOpenBraceOnNewLineForFunctions: Boolean(
      formatSettings && formatSettings.placeOpenBraceOnNewLineForControlBlocks
    )
  };
}

function computeInitialIndent(
  document: TextDocument,
  range: Range,
  options: FormattingOptions
) {
  const lineStart = document.offsetAt(Position.create(range.start.line, 0));
  const content = document.getText();

  let i = lineStart;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    const ch = content.charAt(i);
    if (ch === ' ') {
      nChars++;
    } else if (ch === '\t') {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}

function generateIndent(level: number, options: FormattingOptions) {
  if (options.insertSpaces) {
    return repeat(' ', level * options.tabSize);
  } else {
    return repeat('\t', level);
  }
}
