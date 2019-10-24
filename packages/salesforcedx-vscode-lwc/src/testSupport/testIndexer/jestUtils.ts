import {
  IParseResults,
  ItBlock,
  ParsedNode,
  ParsedNodeTypes
} from 'jest-editor-support';
import { escapeStrForRegex } from 'jest-regex-util';
import stripAnsi from 'strip-ansi';
import * as vscode from 'vscode';

type ParsedNodeWithAncestorTitles = Pick<
  ParsedNode,
  Exclude<keyof ParsedNode, 'children'>
> & {
  name?: string;
  ancestorTitles?: string[];
  children?: ParsedNodeWithAncestorTitles[];
};
export type ItBlockWithAncestorTitles = ItBlock & { ancestorTitles?: string[] };
export type IExtendedParseResults = Pick<
  IParseResults,
  Exclude<keyof IParseResults, 'root'>
> & {
  root: ParsedNodeWithAncestorTitles;
  itBlocksWithAncestorTitles?: ItBlockWithAncestorTitles[];
};

function populateAncestorTitlesRecursive(
  node: ParsedNodeWithAncestorTitles,
  ancestorTitles: string[],
  itBlocksWithAncestorTitles: ItBlockWithAncestorTitles[]
) {
  node.ancestorTitles = ancestorTitles;
  if (node.type === ParsedNodeTypes.it) {
    itBlocksWithAncestorTitles.push(node as ItBlockWithAncestorTitles);
  }
  if (
    node.type === ParsedNodeTypes.root ||
    node.type === ParsedNodeTypes.describe
  ) {
    if (!node.children) {
      return;
    }
    node.children.forEach(childNode => {
      populateAncestorTitlesRecursive(
        childNode,
        node.name ? [...ancestorTitles, node.name] : ancestorTitles,
        itBlocksWithAncestorTitles
      );
    });
  }
}

export function populateAncestorTitles(parsedResult: IExtendedParseResults) {
  try {
    const itBlocksWithAncestorTitles: ItBlockWithAncestorTitles[] = [];
    populateAncestorTitlesRecursive(
      parsedResult.root,
      [],
      itBlocksWithAncestorTitles
    );
    parsedResult.itBlocksWithAncestorTitles = itBlocksWithAncestorTitles;
    return parsedResult;
  } catch (error) {
    console.error(error);
  }
}

export function extractPositionFromFailureMessage(
  testFsPath: string,
  failureMessage: string
) {
  try {
    const locationMatcher = new RegExp(
      escapeStrForRegex(testFsPath) + '\\:(\\d+)\\:(\\d+)',
      'i'
    );
    const matchResult = failureMessage.match(locationMatcher);
    if (matchResult) {
      const lineString = matchResult[1];
      const columnString = matchResult[2];
      const line = parseInt(lineString, 10);
      const column = parseInt(columnString, 10);
      if (isNaN(line) || isNaN(column)) {
        return undefined;
      }
      return new vscode.Position(line - 1, column - 1);
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
}

export function sanitizeFailureMessage(failureMessage: string) {
  return stripAnsi(failureMessage);
}
