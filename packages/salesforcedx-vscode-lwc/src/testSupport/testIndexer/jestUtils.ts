/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IParseResults, ItBlock, ParsedNode, ParsedNodeTypes } from 'jest-editor-support';
import { escapeStrForRegex } from 'jest-regex-util';
import stripAnsi from 'strip-ansi';
import * as vscode from 'vscode';

type ParsedNodeWithAncestorTitles = Pick<ParsedNode, Exclude<keyof ParsedNode, 'children'>> & {
  name?: string;
  ancestorTitles?: string[];
  children?: ParsedNodeWithAncestorTitles[];
};
/**
 * Extended itBlock definition with ancestor titles
 */
export type ItBlockWithAncestorTitles = ItBlock & { ancestorTitles?: string[] };
/**
 * Extended parse results definition with extended itBlock definition
 */
export type IExtendedParseResults = Pick<IParseResults, Exclude<keyof IParseResults, 'root'>> & {
  root: ParsedNodeWithAncestorTitles;
  itBlocksWithAncestorTitles?: ItBlockWithAncestorTitles[];
};

const populateAncestorTitlesRecursive = (
  node: ParsedNodeWithAncestorTitles,
  ancestorTitles: string[],
  itBlocksWithAncestorTitles: ItBlockWithAncestorTitles[]
) => {
  node.ancestorTitles = ancestorTitles;
  if (node.type === ParsedNodeTypes.it) {
    itBlocksWithAncestorTitles.push(node as ItBlockWithAncestorTitles);
  }
  if (node.type === ParsedNodeTypes.root || node.type === ParsedNodeTypes.describe) {
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
};

/**
 * Populate ancestor titles for itBlocks
 * @param parsedResult original parse results
 */
export const populateAncestorTitles = (parsedResult: IExtendedParseResults) => {
  try {
    const itBlocksWithAncestorTitles: ItBlockWithAncestorTitles[] = [];
    populateAncestorTitlesRecursive(parsedResult.root, [], itBlocksWithAncestorTitles);
    parsedResult.itBlocksWithAncestorTitles = itBlocksWithAncestorTitles;
    return parsedResult;
  } catch (error) {
    console.error(error);
  }
};

/**
 * Extract the VS Code position from failure message stacktrace in Jest output.
 * @param testFsPath test file path
 * @param failureMessage failure message from Jest output
 */
export const extractPositionFromFailureMessage = (testFsPath: string, failureMessage: string) => {
  try {
    const locationMatcher = new RegExp(escapeStrForRegex(testFsPath) + '\\:(\\d+)\\:(\\d+)', 'i');
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
};

/**
 * Strip the ANSI color codes from failure message
 * @param failureMessage failure message from Jest output
 */
export const sanitizeFailureMessage = (failureMessage: string) => {
  return stripAnsi(failureMessage);
};
