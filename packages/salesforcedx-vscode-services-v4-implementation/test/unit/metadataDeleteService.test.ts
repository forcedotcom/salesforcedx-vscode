/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import { ComponentSet, DestructiveChangesType, SourceComponent } from '@salesforce/source-deploy-retrieve';
import { MetadataDeleteService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { createMetadataOperationTest } from '../support/metadataOperation.js';

it('marks real source for post-deploy deletion, preserves ComponentSet properties, and removes both local files', async () => {
  const fixture = await createMetadataOperationTest();
  try {
    fixture.components.apiVersion = '68.0';
    fixture.components.sourceApiVersion = '67.0';
    const service = await fixture.runtime.runPromise(MetadataDeleteService);
    const deleted = await fixture.runtime.runPromise(service.markComponentsForDeletion(fixture.components));
    expect(deleted.projectDirectory).toBe(fixture.components.projectDirectory);
    expect(deleted.apiVersion).toBe('68.0');
    expect(deleted.sourceApiVersion).toBe('67.0');
    const components = Array.from(deleted.getSourceComponents());
    expect(components).toHaveLength(1);
    expect(components[0].isMarkedForDelete()).toBe(true);
    expect(components[0].getDestructiveChangesType()).toBe(DestructiveChangesType.POST);
    await fixture.runtime.runPromise(service.deleteLocalFiles(deleted));
    await expect(coreFs.fs.promises.stat(fixture.source.fsPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(coreFs.fs.promises.stat(`${fixture.source.fsPath}-meta.xml`)).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await fixture.runtime.dispose();
    expect(Exit.isFailure(await Effect.runPromiseExit(service.deleteLocalFiles(deleted)))).toBe(true);
  } finally {
    await fixture.dispose();
  }
});

it('uses native CustomLabel deletion to preserve other labels and their shared XML file', async () => {
  const fixture = await createMetadataOperationTest();
  try {
    const labels = Utils.joinPath(
      fixture.root,
      'force-app',
      'main',
      'default',
      'labels',
      'CustomLabels.labels-meta.xml'
    );
    await coreFs.fs.promises.mkdir(Utils.dirname(labels).fsPath, { recursive: true });
    await coreFs.fs.promises.writeFile(
      labels.fsPath,
      '<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"><labels><fullName>Remove</fullName><language>en_US</language><protected>false</protected><shortDescription>Remove</shortDescription><value>Remove</value></labels><labels><fullName>Keep</fullName><language>en_US</language><protected>false</protected><shortDescription>Keep</shortDescription><value>Keep</value></labels></CustomLabels>'
    );
    const components = Array.from(ComponentSet.fromSource(labels.fsPath).getSourceComponents()).flatMap(component =>
      component.type.name === 'CustomLabel' ? [component] : Array.from(component.getChildren())
    );
    const remove = components.find(component => component.fullName === 'Remove');
    assert.ok(remove instanceof SourceComponent);
    await fixture.runtime.runPromise(
      MetadataDeleteService.use(service => service.deleteLocalFiles(new ComponentSet([remove])))
    );
    const remaining = String(await coreFs.fs.promises.readFile(labels.fsPath));
    expect(remaining).toContain('<fullName>Keep</fullName>');
    expect(remaining).not.toContain('<fullName>Remove</fullName>');
  } finally {
    await fixture.dispose();
  }
});

it('drains a started native delete before owner disposal releases the filesystem dependency', async () => {
  const fixture = await createMetadataOperationTest();
  const release = Promise.withResolvers<void>();
  let stopped: Promise<unknown> | undefined;
  try {
    const entered = Promise.withResolvers<void>();
    vi.mocked(vscode.workspace.fs.delete).mockImplementationOnce(async (uri, options) => {
      entered.resolve();
      await release.promise;
      await coreFs.fs.promises.rm(uri.fsPath, { recursive: options?.recursive ?? false });
    });
    const result = fixture.runtime.runPromiseExit(
      MetadataDeleteService.use(service => service.deleteLocalFiles(fixture.components))
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
    await expect(coreFs.fs.promises.stat(fixture.source.fsPath)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    release.resolve();
    await stopped;
    await fixture.dispose();
  }
});
