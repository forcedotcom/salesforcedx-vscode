/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export type LSPApexTestMethod = {
  methodName: string;
  definingType: string;
  location: LSPLocation;
};

type LSPLocation = {
  uri: string; // Uri is transferred as a string instead of Uri
  range: { start: LSPPosition; end: LSPPosition };
};

type LSPPosition = {
  line: number;
  character: number;
};

export type ApexTestMethod = {
  methodName: string;
  definingType: string;
  location: vscode.Location;
};

export const toApexTestMethod = (requestInfo: LSPApexTestMethod): ApexTestMethod => ({
  ...requestInfo,
  location: toLocation(requestInfo.location)
});

const toUri = (lspUri: string): URI => {
  const uriPath = URI.parse(lspUri).path;
  return URI.file(uriPath);
};

const toPosition = (lspPosition: LSPPosition): vscode.Position =>
  new vscode.Position(lspPosition.line, lspPosition.character);

const toLocation = (lspLocation: LSPLocation): vscode.Location => {
  const actualUri = toUri(lspLocation.uri);
  const actualStart = toPosition(lspLocation.range.start);
  const actualEnd = toPosition(lspLocation.range.end);
  const actualRange = new vscode.Range(actualStart, actualEnd);
  return new vscode.Location(actualUri, actualRange);
};
