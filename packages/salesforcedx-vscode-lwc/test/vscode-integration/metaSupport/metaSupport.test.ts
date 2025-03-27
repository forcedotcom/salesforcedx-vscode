/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { extensions } from 'vscode';
import { nls } from '../../../src/messages';
import { MockRedhatExtension } from './MockRhExtension';
import { metaSupport } from '../../../src/metasupport';
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';

let sandbox = sinon.createSandbox();
let rhExtension: any;
let appendLineSpy: sinon.SinonSpy<any, any>;

describe('MetaSupport: Extension version supported', () => {
  beforeEach(() => {
    appendLineSpy = sinon.spy(ChannelService.prototype, 'appendLine');
  });

  afterEach(() => {
    sandbox.restore();
    appendLineSpy.restore();
  });

  it('Should post error message if XML extension is a minor version too old', async () => {
    sandbox.stub(extensions, 'getExtension').returns(new MockRedhatExtension('0.13.0'));
    await metaSupport.getMetaSupport();
    expect(appendLineSpy).to.have.calledOnceWith(nls.localize('lightning_lwc_deprecated_redhat_extension'));
  });

  it('Should post error message if XML extension is a patch version too old', async () => {
    sandbox.stub(extensions, 'getExtension').returns(new MockRedhatExtension('0.13.2'));
    await metaSupport.getMetaSupport();
    expect(appendLineSpy).to.have.calledOnceWith(nls.localize('lightning_lwc_deprecated_redhat_extension'));
  });

  it('Should post error message if XML extension is 0.15.0', async () => {
    sandbox.stub(extensions, 'getExtension').returns(new MockRedhatExtension('0.15.0'));
    await metaSupport.getMetaSupport();
    expect(appendLineSpy).to.have.calledOnceWith(nls.localize('lightning_lwc_redhat_extension_regression'));
  });
});

describe('MetaSupport: Extension not found', () => {
  beforeEach(() => {
    sandbox.stub(extensions, 'getExtension').returns(undefined);
    appendLineSpy = sinon.spy(ChannelService.prototype, 'appendLine');
  });

  afterEach(() => {
    sandbox.restore();
    appendLineSpy.restore();
  });

  it('Should provide information to install XML plugin if not found', async () => {
    await metaSupport.getMetaSupport();
    expect(appendLineSpy).to.have.calledOnceWith(nls.localize('lightning_lwc_no_redhat_extension_found'));
  });
});

['0.14.0', '0.16.0', '1.0.0'].forEach(rhExtensionVersion => {
  describe(`MetaSupport: Extension v${rhExtensionVersion} function`, () => {
    beforeEach(() => {
      rhExtension = new MockRedhatExtension(rhExtensionVersion);
      sandbox.stub(extensions, 'getExtension').returns(rhExtension);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('Should pass correct catalog path to XML extension', async () => {
      await metaSupport.getMetaSupport();

      const catalogPaths = [path.join('extension', 'local', 'path', 'resources', 'static', 'js-meta-home.xml')];
      assert.strictEqual(rhExtension.api.listOfCatalogs[0], catalogPaths[0]);
    });

    it('Should pass correct file association path to XML extension', async () => {
      await metaSupport.getMetaSupport();

      const systemId = path.join('extension', 'local', 'path', 'resources', 'static', 'js-meta.xsd');
      const pattern = '**/*js-meta.xml';

      assert.strictEqual(rhExtension.api.listOfAssociations[0]['systemId'], systemId);
      assert.strictEqual(rhExtension.api.listOfAssociations[0]['pattern'], pattern);
    });
  });
});
