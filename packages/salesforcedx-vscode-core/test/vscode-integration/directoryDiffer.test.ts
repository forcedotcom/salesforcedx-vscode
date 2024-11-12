/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as AdmZip from 'adm-zip';
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as shell from 'shelljs';
import { CommonDirDirectoryDiffer } from '../../src/conflict';

describe('Directory Differ', () => {
  const TEST_DATA_FOLDER = path.join(__dirname, '..', '..', '..', '..', 'system-tests', 'assets', 'differ-testdata');
  let testRoot: string;
  let dirOne: string;
  let dirTwo: string;

  beforeEach(() => {
    testRoot = path.join(os.tmpdir(), 'diff-test', `${new Date().getTime()}`);
    dirOne = path.join(testRoot, 'One');
    dirTwo = path.join(testRoot, 'Two');

    const testZip = new AdmZip();
    testZip.addLocalFolder(TEST_DATA_FOLDER);
    testZip.extractAllTo(dirOne);
    testZip.extractAllTo(dirTwo);

    // make directory membership slightly different
    const toRemove = path.join(dirTwo, 'pages', 'TestPage.page');
    shell.rm(toRemove);
  });

  it('Should detect no differences', () => {
    console.log('TestRoot: ' + testRoot);
    const differ = new CommonDirDirectoryDiffer();
    const results = differ.diff(dirOne, dirTwo);

    expect(results.different.size, 'should not have detected differences').to.equal(0);
    expect(results.scannedLocal, 'incorrect number of files scanned in dirOne').to.equal(43);
    expect(results.scannedRemote, 'incorrect number of files scanned in dirTwo').to.equal(42);
  });

  it('Should detect text differences', () => {
    console.log('TestRoot: ' + testRoot);
    const cls1ToChange = path.join('classes', 'JWT.cls');
    const cls2ToChange = path.join('classes', 'JWTBearerFlow.cls');
    const layoutToChange = path.join('layouts', 'User-User Layout.layout-meta.xml');

    const replacementText = `${new Date().getTime()}`;
    const filesToChange = [cls1ToChange, cls2ToChange, layoutToChange];
    filesToChange.forEach(f => {
      const source = path.join(dirOne, f);
      const target = path.join(dirTwo, f);
      const content: string = fs.readFileSync(source, 'utf8');
      const updates = content.replace('LOCAL-CHANGE-FOR-TESTING', replacementText);
      fs.writeFileSync(target, updates, 'utf8');
    });

    const differ = new CommonDirDirectoryDiffer();
    const results = differ.diff(dirOne, dirTwo);

    expect(results.different).to.eql(
      new Set([
        {
          localRelPath: cls1ToChange,
          remoteRelPath: cls1ToChange
        },
        {
          localRelPath: layoutToChange,
          remoteRelPath: layoutToChange
        }
      ])
    );
    expect(results.scannedLocal, 'incorrect number of files scanned in dirOne').to.equal(43);
    expect(results.scannedRemote, 'incorrect number of files scanned in dirTwo').to.equal(42);
  });

  it('Should detect binary differences', () => {
    console.log('TestRoot: ' + testRoot);
    const differ = new CommonDirDirectoryDiffer();

    const source = path.join(dirOne, 'staticresources', 'leaflet', 'images', 'layers.png');
    const target = path.join(dirOne, 'staticresources', 'leaflet', 'images', 'marker-icon.png');

    // overwrite the target
    shell.cp(source, target);
    const results = differ.diff(dirOne, dirTwo);

    expect(results.different).to.eql(
      new Set([
        {
          localRelPath: path.join('staticresources', 'leaflet', 'images', 'marker-icon.png'),
          remoteRelPath: path.join('staticresources', 'leaflet', 'images', 'marker-icon.png')
        }
      ])
    );
    expect(results.scannedLocal, 'incorrect number of files scanned in dirOne').to.equal(43);
    expect(results.scannedRemote, 'incorrect number of files scanned in dirTwo').to.equal(42);
  });
});
