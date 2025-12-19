/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { collectBundleMetadata, BundleConfig, type ScriptFile } from '@lwc/metadata';
import { transform } from '@lwc/old-compiler';

import { CompilerOptions as OldCompilerOptions } from '@lwc/old-compiler/dist/types/compiler/options';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { mapLwcMetadataToInternal } from '../typeMapping';

const isScriptFile = (file: any): file is ScriptFile => 'classes' in file;

it('can map new metadata to old metadata', async () => {
  const filepath = vscode.Uri.file(path.join(__dirname, 'fixtures', 'metadata.js'));
  const fileBuffer = await vscode.workspace.fs.readFile(filepath);
  const content = Buffer.from(fileBuffer).toString('utf8');

  const newMetadataOpts: BundleConfig = {
    type: 'internal',
    name: 'metadata',
    namespace: 'x',
    namespaceMapping: {},
    files: [
      {
        fileName: 'metadata.js',
        source: content
      }
    ],
    npmModuleMapping: {}
  };

  const modernMetadata = collectBundleMetadata(newMetadataOpts);
  const scriptFile = modernMetadata.files.find(isScriptFile);
  expect(scriptFile).toBeDefined();
  const derivedMetadata = mapLwcMetadataToInternal(scriptFile!);

  const oldTransformOpts: OldCompilerOptions = {
    name: 'metadata',
    namespace: 'x',
    files: {}
  };
  const transformerResult = await transform(content, 'metadata.js', oldTransformOpts);
  const oldMetadata = transformerResult.metadata;
  expect(oldMetadata).toBeDefined();

  expect(derivedMetadata).toEqual(oldMetadata);
});

it('Should handle mapping when there is a property with only a setter', async () => {
  const filepath = vscode.Uri.file(path.join(__dirname, 'fixtures', 'nogetter.js'));
  const fileBuffer = await vscode.workspace.fs.readFile(filepath);
  const content = Buffer.from(fileBuffer).toString('utf8');

  const newMetadataOpts: BundleConfig = {
    type: 'internal',
    name: 'nogetter',
    namespace: 'x',
    namespaceMapping: {},
    files: [
      {
        fileName: 'nogetter.js',
        source: content
      }
    ],
    npmModuleMapping: {}
  };

  const modernMetadata = collectBundleMetadata(newMetadataOpts);
  const scriptFile = modernMetadata.files.find(isScriptFile);
  expect(scriptFile).toBeDefined();
  const derivedMetadata = mapLwcMetadataToInternal(scriptFile!);

  const oldTransformOpts: OldCompilerOptions = {
    name: 'metadata',
    namespace: 'x',
    files: {}
  };
  const transformerResult = await transform(content, 'nogetter.js', oldTransformOpts);
  const oldMetadata = transformerResult.metadata;
  expect(oldMetadata).toBeDefined();

  expect(derivedMetadata).toEqual(oldMetadata);
});
