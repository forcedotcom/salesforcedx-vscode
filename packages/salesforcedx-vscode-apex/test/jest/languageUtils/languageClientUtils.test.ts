/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ClientStatus,
  LanguageClientStatus,
  LanguageClientUtils
} from '../../../src/languageUtils/languageClientUtils';

describe('LanguageClientUtils', () => {
  let languageClientUtils: LanguageClientUtils;

  beforeEach(() => {
    languageClientUtils = LanguageClientUtils.getInstance();
  });

  it('Should return correct initial status', async () => {
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).to.equal(false);
    expect(clientStatus.isIndexing()).to.equal(false);
    expect(clientStatus.failedToInitialize()).to.equal(false);
    expect(clientStatus.getStatusMessage()).to.equal('');
  });

  it('Should return ready status', async () => {
    languageClientUtils.setStatus(ClientStatus.Ready, 'Apex client is ready');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).to.equal(true);
    expect(clientStatus.isIndexing()).to.equal(false);
    expect(clientStatus.failedToInitialize()).to.equal(false);
    expect(clientStatus.getStatusMessage()).to.equal('Apex client is ready');
  });

  it('Should return indexing status', async () => {
    languageClientUtils.setStatus(ClientStatus.Indexing, 'Apex client is indexing');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).to.equal(false);
    expect(clientStatus.isIndexing()).to.equal(true);
    expect(clientStatus.failedToInitialize()).to.equal(false);
    expect(clientStatus.getStatusMessage()).to.equal('Apex client is indexing');
  });

  it('Should return error status', async () => {
    languageClientUtils.setStatus(ClientStatus.Error, 'Java version is misconfigured');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).to.equal(false);
    expect(clientStatus.isIndexing()).to.equal(false);
    expect(clientStatus.failedToInitialize()).to.equal(true);
    expect(clientStatus.getStatusMessage()).to.equal('Java version is misconfigured');
  });
});
