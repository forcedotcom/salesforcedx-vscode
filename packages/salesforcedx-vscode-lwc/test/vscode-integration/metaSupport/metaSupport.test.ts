/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { extensions, window } from 'vscode';
import { nls } from '../../../src/messages';
import { MockRedhatExtension } from './MockRhExtension';
import { metaSupport } from '../../../src/metasupport';
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';

let sandbox = sinon.createSandbox();
let infoMessageStub: any;
let mockRhExtension: any;
let rhExtension: any;

describe('MetaSupport: Extension version too old', () => {

  beforeEach(() => {
    mockRhExtension = sandbox.stub(extensions, 'getExtension').returns(new MockRedhatExtension('0.12.0'));
    infoMessageStub = sandbox.stub(window, 'showInformationMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should provide information to update XML plugin', async () => {
    await metaSupport.getMetaSupport();
    expect(infoMessageStub).to.have.calledOnceWith(nls.localize('force_lightning_lwc_deprecated_redhat_extension'));
  });

});

describe('MetaSupport: Extension not found', () => {

  beforeEach(() => {
    mockRhExtension = sandbox.stub(extensions, 'getExtension').returns(undefined);
    infoMessageStub = sandbox.stub(window, 'showInformationMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should provide information to install XML plugin', async () => {
    await metaSupport.getMetaSupport();
    expect(infoMessageStub).to.have.calledOnceWith(nls.localize('force_lightning_lwc_no_redhat_extension_found'));
  });
});


describe('MetaSupport: Extension function', () => {

  beforeEach(() => {
    rhExtension = new MockRedhatExtension('0.13.1')
    mockRhExtension = sandbox.stub(extensions, 'getExtension').returns(rhExtension);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should pass correct catalog path', async () => {
    await metaSupport.getMetaSupport();

    const catalogPaths = [path.join('extension', 'local', 'path', 'resources', 'static', 'js-meta-home.xml')]
    assert.equal(rhExtension.api.listOfCatalogs[0], catalogPaths[0]);
  });

  it('Should pass correct file association path', async () => {
    await metaSupport.getMetaSupport();

    const systemId = path.join('extension', 'local', 'path', 'resources', 'static', 'js-meta.xsd');
    const pattern = '**/*js-meta.xml';

    assert.equal(rhExtension.api.listOfAssociations[0]['systemId'], systemId);
    assert.equal(rhExtension.api.listOfAssociations[0]['pattern'], pattern);

  });

});
