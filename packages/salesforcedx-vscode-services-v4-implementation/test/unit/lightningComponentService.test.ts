/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import { LightningComponentService } from '@salesforce/vscode-services-v2';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { createMetadataOperationTest } from '../support/metadataOperation.js';

const writeBundle = async (bundle: URI, files: string[]) => {
  await Promise.all(
    files.map(async file => {
      const uri = Utils.joinPath(bundle, ...file.split('/'));
      await coreFs.fs.promises.mkdir(Utils.dirname(uri).fsPath, { recursive: true });
      await coreFs.fs.promises.writeFile(uri.fsPath, file);
    })
  );
};

it.each(['lwc', 'aura'] as const)(
  'renames actual %s bundle files and fuzzy test names, preserving unrelated names and contents',
  async kind => {
    const fixture = await createMetadataOperationTest();
    try {
      const name = 'old+card';
      const bundle = Utils.joinPath(fixture.root, 'force-app', 'main', 'default', kind, name);
      const files =
        kind === 'lwc'
          ? [`${name}.js`, `${name}.html`, `${name}.js-meta.xml`, `${name}.test.ts`]
          : [`${name}.cmp`, `${name}Controller.js`, `${name}Helper.js`, `${name}.design`];
      await writeBundle(bundle, [...files, 'unrelated.js', `${name}.md`, `__tests__/${name}.${name}.small.test.js`]);
      const renamed = await fixture.runtime.runPromise(
        LightningComponentService.use(service =>
          service.renameBundle({
            bundleUri: bundle,
            oldName: name,
            newName: 'newCard',
            kind
          })
        )
      );
      const actual = (await coreFs.fs.promises.readdir(renamed.fsPath, { recursive: true }))
        .map(file => file.replaceAll('\\', '/'))
        .toSorted();
      expect(actual).toEqual(
        [
          ...files.map(file => file.replaceAll(name, 'newCard')),
          'unrelated.js',
          `${name}.md`,
          '__tests__',
          '__tests__/newCard.newCard.small.test.js'
        ].toSorted()
      );
      expect(
        String(await coreFs.fs.promises.readFile(Utils.joinPath(renamed, files[0].replaceAll(name, 'newCard')).fsPath))
      ).toBe(files[0]);
      await expect(coreFs.fs.promises.stat(bundle.fsPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fixture.dispose();
    }
  }
);

it('drains the first started rename on disposal but does not mask the rest of the bundle pipeline', async () => {
  const fixture = await createMetadataOperationTest();
  const release = Promise.withResolvers<void>();
  let stopped: Promise<unknown> | undefined;
  try {
    const bundle = Utils.joinPath(fixture.root, 'force-app', 'main', 'default', 'lwc', 'oldCard');
    await writeBundle(bundle, ['oldCard.js', 'oldCard.html']);
    const entered = Promise.withResolvers<void>();
    const rename = vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(async (source, target) => {
      entered.resolve();
      await release.promise;
      await coreFs.fs.promises.rename(source.fsPath, target.fsPath);
    });
    const result = fixture.runtime.runPromiseExit(
      LightningComponentService.use(service =>
        service.renameBundle({
          bundleUri: bundle,
          oldName: 'oldCard',
          newName: 'newCard',
          kind: 'lwc'
        })
      )
    );
    await entered.promise;
    let finished = false;
    stopped = Promise.all([fixture.runtime.dispose(), result]).then(value => {
      finished = true;
      return value;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    release.resolve();
    await stopped;
    expect(rename).toHaveBeenCalledTimes(1);
    expect((await coreFs.fs.promises.stat(bundle.fsPath)).isDirectory()).toBe(true);
    await expect(
      coreFs.fs.promises.stat(Utils.joinPath(Utils.dirname(bundle), 'newCard').fsPath)
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(Exit.isFailure(await result)).toBe(true);
  } finally {
    release.resolve();
    await stopped;
    await fixture.dispose();
  }
});
