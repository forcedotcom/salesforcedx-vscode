/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { RevealOutputChannelOn } from 'vscode-languageclient';
import { buildClientOptions, code2ProtocolConverter } from '../../src/languageServer';

describe('Apex Language Server Client', () => {
  describe('Should properly handle sending URI to server on Windows', () => {
    let originalPlatform: PropertyDescriptor;

    beforeEach(() => {
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', originalPlatform);
    });

    it('Should only replace first :', () => {
      const actual = code2ProtocolConverter(Uri.parse('file:///c%3A/path/to/file/with%20%3A%20in%20name'));
      expect(actual).to.be.eql('file:///c:/path/to/file/with%20%3A%20in%20name');
    });
  });

  describe('Should properly handle sending URI to server on *nix', () => {
    let originalPlatform: PropertyDescriptor;

    beforeEach(() => {
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', originalPlatform);
    });

    it('Should not replace first :', () => {
      const actual = code2ProtocolConverter(Uri.parse('file:///path/to/file/with%20%3A%20in%20name'));
      expect(actual).to.be.eql('file:///path/to/file/with%20%3A%20in%20name');
    });
  });

  describe('Should conditionally initialize server for SOQL block detection', () => {
    const sandbox = createSandbox();

    beforeEach(() => {});
    afterEach(() => sandbox.restore());

    it('should enable it when SOQL extension is present', () => {
      sandbox.stub(vscode.extensions, 'getExtension').withArgs('salesforce.salesforcedx-vscode-soql').returns({});

      const clientOptions = buildClientOptions();

      expect(clientOptions.middleware).not.to.be.undefined;
      expect(clientOptions.initializationOptions).not.to.be.undefined;
      expect(clientOptions.initializationOptions.enableEmbeddedSoqlCompletion).to.be.true;
    });

    it('should disable it when SOQL extension is present', () => {
      sandbox
        .stub(vscode.extensions, 'getExtension')
        .withArgs('salesforce.salesforcedx-vscode-soql')
        .returns(undefined);

      const clientOptions = buildClientOptions();

      expect(clientOptions.middleware).to.be.undefined;
      expect(clientOptions.initializationOptions).not.to.be.undefined;
      expect(clientOptions.initializationOptions.enableEmbeddedSoqlCompletion).to.be.false;
    });
  });

  describe('Should not actively disturb user while running in the background', () => {
    const sandbox = createSandbox();

    beforeEach(() => {});
    afterEach(() => sandbox.restore());

    it('should never reveal output channel', () => {
      sandbox.stub(vscode.extensions, 'getExtension').withArgs('salesforce.salesforcedx-vscode-soql').returns({});

      const clientOptions = buildClientOptions();

      expect(clientOptions.revealOutputChannelOn).to.equal(RevealOutputChannelOn.Never);
    });
  });

  describe('Anonymous Apex Support', () => {
    const sandbox = createSandbox();

    beforeEach(() => {});
    afterEach(() => sandbox.restore());

    it('should enable document selector for anon-apex', () => {
      const clientOptions = buildClientOptions();

      expect(clientOptions.documentSelector).not.to.be.undefined;
      expect(clientOptions.documentSelector).to.deep.include.members([
        {
          language: 'apex-anon',
          scheme: 'file'
        }
      ]);
    });
  });
});
