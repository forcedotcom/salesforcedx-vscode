/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { ProjectSObjectSelector } from '../../src/transformer/transformerFactory';
import { SObjectCategory, SObjectRefreshSource } from '../../src/types';

const SOBJECTS_DESCRIBE_SAMPLE = {
  sobjects: [
    { custom: true, name: 'MyCustomObj1' },
    { custom: true, name: 'MyCustomObj2' },
    { custom: true, name: 'Custom_History_Obj' },
    { custom: true, name: 'MyCustomObj1Share' },
    { custom: true, name: 'MyCustomObj2History' },
    { custom: true, name: 'MyCustomObj1Feed' },
    { custom: true, name: 'MyCustomObj2Event' },
    { custom: false, name: 'Account' },
    { custom: false, name: 'Contact' },
    { custom: false, name: 'Lead' },
    { custom: false, name: 'LeadHistory' },
    { custom: false, name: 'Event' }
  ]
};

const setupSelector = async (
  sb: sinon.SinonSandbox,
  numberOfPackageDirs: number,
  projectFiles: string[]
): Promise<ProjectSObjectSelector> => {
  const packageDirs = Array.from({ length: numberOfPackageDirs }, (_, i) =>
    path.join(process.cwd(), `package${i}`)
  );
  const objectFiles = packageDirs.flatMap(dir =>
    projectFiles.map(f =>
      path.relative(dir, path.join(dir, 'objects', f, 'foo'))
    )
  );
  // @ts-expect-error: private method
  sb.stub(ProjectSObjectSelector.prototype, 'getPackageDirs').resolves(
    packageDirs
  );
  // @ts-expect-error: private method
  sb.stub(ProjectSObjectSelector.prototype, 'findObjectsInProject').resolves(
    objectFiles
  );
  const selector = new ProjectSObjectSelector(
    SObjectCategory.CUSTOM,
    SObjectRefreshSource.Manual
  );
  await selector.scanForProjectSObjects();
  return selector;
};

describe.skip('Select sObjects', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should return empty array when no project objects', async () => {
    const selector = await setupSelector(sandbox, 0, []);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s =>
      selector.select(s)
    );

    expect(results.length).to.eql(0);
  });

  it('Should return only custom sobjects when project contains only custom object', async () => {
    const selector = await setupSelector(sandbox, 1, ['Custom_History_Obj']);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s =>
      selector.select(s)
    );

    expect(results).to.deep.equal([
      { custom: true, name: 'Custom_History_Obj' }
    ]);
  });

  it('Should return only custom sobjects when project contains only standard objects', async () => {
    const selector = await setupSelector(sandbox, 1, ['Account', 'Contact']);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s =>
      selector.select(s)
    );

    expect(results).to.deep.equal([
      { custom: false, name: 'Account' },
      { custom: false, name: 'Contact' }
    ]);
  });
});
