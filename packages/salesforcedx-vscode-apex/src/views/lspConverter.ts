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

export class ApexLSPConverter {
  public static toApexTestMethod(requestInfo: LSPApexTestMethod): ApexTestMethod {
    const testLocation = ApexLSPConverter.toLocation(requestInfo.location);
    return {
      methodName: requestInfo.methodName,
      definingType: requestInfo.definingType,
      location: testLocation
    };
  }

  public static toUri(lspUri: string): URI {
    const uriString = lspUri;
    const uriPath = URI.parse(uriString).path;
    return URI.file(uriPath);
  }

  public static toLocation(lspLocation: LSPLocation): vscode.Location {
    const actualUri = ApexLSPConverter.toUri(lspLocation.uri);
    const actualStart = ApexLSPConverter.toPosition(lspLocation.range.start);
    const actualEnd = ApexLSPConverter.toPosition(lspLocation.range.end);
    const actualRange = new vscode.Range(actualStart, actualEnd);
    return new vscode.Location(actualUri, actualRange);
  }

  public static toPosition(lspPosition: LSPPosition): vscode.Position {
    return new vscode.Position(lspPosition.line, lspPosition.character);
  }
}
