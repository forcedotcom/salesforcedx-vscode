/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { getErrorMessage } from './errorHandlerService';
import { FsService } from './fsService';

const licenseFileName = /^(?:licen[cs]e|copying)(?:\.(?:txt|md|markdown))?$/i;
const licenseNames = ['LICENSE', 'LICENCE', 'COPYING'].flatMap(base =>
  ['.txt', '.md', '.markdown', ''].flatMap(extension => [`${base}${extension}`, `${base.toLowerCase()}${extension}`])
);

const isMissingFile = (error: unknown): boolean =>
  error instanceof vscode.FileSystemError && (error.code === 'FileNotFound' || error.code === 'ENOENT');

const isMissingLicenseCandidate = (error: unknown): boolean =>
  isMissingFile(error) ||
  // The Web Console's virtual extension provider reports its name for an absent candidate.
  getErrorMessage(error) === 'devextensions';

const packageProperty = (extension: vscode.Extension<unknown>, key: string): unknown => {
  const manifest: unknown = extension.packageJSON;
  return typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, key) : undefined;
};

const displayNameOf = (extension: vscode.Extension<unknown>): string => {
  const displayName = packageProperty(extension, 'displayName');
  return typeof displayName === 'string' && displayName.trim() ? displayName : extension.id;
};

const explicitLicenseUrl = (extension: vscode.Extension<unknown>): URI | undefined => {
  const license = packageProperty(extension, 'license');
  const candidates = [
    packageProperty(extension, 'licenseUrl'),
    typeof license === 'object' && license !== null ? Reflect.get(license, 'url') : license
  ];
  const url = candidates.find(candidate => typeof candidate === 'string' && /^https:\/\//i.test(candidate));
  if (typeof url !== 'string') return undefined;
  const uri = URI.parse(url);
  return uri.scheme === 'https' && uri.authority ? uri : undefined;
};

const showSelectedLicense = (extension: vscode.Extension<unknown>) =>
  Effect.gen(function* () {
    const names =
      extension.extensionUri.scheme === 'devextensions'
        ? licenseNames
        : yield* Effect.tryPromise(() => vscode.workspace.fs.readDirectory(extension.extensionUri)).pipe(
            Effect.map(files =>
              files
                .filter(([, type]) => type === vscode.FileType.File)
                .map(([name]) => name)
                .filter(name => licenseFileName.test(name))
            ),
            Effect.catchAll(error => {
              if (isMissingFile(error.error)) return Effect.succeed<string[]>([]);
              if (getErrorMessage(error) === 'devextensions') return Effect.succeed(licenseNames);
              return Effect.fail(error);
            })
          );

    const emptyResult: { document?: vscode.TextDocument } = {};
    const result = yield* Effect.reduceWhile(names, emptyResult, {
      while: ({ document: foundDocument }) => !foundDocument,
      body: (_found, name) =>
        Effect.tryPromise(() => vscode.workspace.openTextDocument(Utils.joinPath(extension.extensionUri, name))).pipe(
          Effect.map(openedDocument => ({ document: openedDocument })),
          Effect.catchAll(error =>
            isMissingLicenseCandidate(error.error) ? Effect.succeed(emptyResult) : Effect.fail(error)
          )
        )
    });
    const licenseDocument = result.document;
    if (licenseDocument) {
      yield* FsService.showTextDocument(licenseDocument.uri, { preview: false });
      return;
    }

    const licenseUrl = explicitLicenseUrl(extension);
    if (licenseUrl) {
      yield* Effect.tryPromise(() => vscode.commands.executeCommand('vscode.open', licenseUrl));
      return;
    }

    const license = packageProperty(extension, 'license');
    const licenseIdentifier = typeof license === 'object' && license !== null ? Reflect.get(license, 'type') : license;
    if (typeof licenseIdentifier === 'string' && licenseIdentifier.trim()) {
      yield* Effect.sync(() => {
        void vscode.window.showInformationMessage(
          nls.localize('extension_license_identifier', displayNameOf(extension), licenseIdentifier)
        );
      });
      return;
    }

    yield* Effect.sync(() => {
      void vscode.window.showWarningMessage(nls.localize('extension_license_missing', displayNameOf(extension)));
    });
  }).pipe(
    Effect.catchAll(error =>
      Effect.sync(() => {
        void vscode.window.showErrorMessage(
          nls.localize('extension_license_open_failed', displayNameOf(extension), getErrorMessage(error))
        );
      })
    )
  );

/** Show the selected installed extension's license in Web Console. */
export const showExtensionLicense = Effect.fn('showExtensionLicense')(function* () {
  const extensions = vscode.extensions.all.filter(
    extension => !['salesforce', 'vscode', 'typescriptteam'].includes(extension.id.split('.')[0].toLowerCase())
  );
  if (extensions.length === 0) {
    yield* Effect.sync(() => {
      void vscode.window.showInformationMessage(nls.localize('no_extension_licenses_available'));
    });
    return;
  }
  if (extensions.length === 1) {
    yield* showSelectedLicense(extensions[0]);
    return;
  }

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      extensions
        .map(extension => ({ label: displayNameOf(extension), description: extension.id, extension }))
        .toSorted(
          (first, second) =>
            first.label.localeCompare(second.label) || first.description.localeCompare(second.description)
        ),
      { placeHolder: nls.localize('select_extension_license'), matchOnDescription: true }
    )
  );
  if (selected) yield* showSelectedLicense(selected.extension);
});
