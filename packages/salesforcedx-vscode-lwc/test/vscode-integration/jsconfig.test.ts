/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { Position, window, workspace, WorkspaceEdit } from 'vscode';
import URI from 'vscode-uri';

const CONFIG_FILENAME = 'jsconfig.json';
const TEST_COMPONENT_NAME = 'testComponent';
const CREATE_COMPONENT_NAME = 'createComponent';

describe('jsconfig Test Suite', () => {
  const lwcDir = path.join(
    workspace.workspaceFolders![0].uri.fsPath,
    'force-app',
    'main',
    'default',
    'lwc'
  );

  const configPath = path.join(lwcDir, CONFIG_FILENAME);
  let config: object;

  beforeEach(async () => {
    await createComponent(TEST_COMPONENT_NAME, lwcDir);
    await waitForConfigUpdate(configPath);
    config = await parseConfig(configPath);
  });

  afterEach(async () => {
    if (fs.existsSync(path.join(lwcDir, TEST_COMPONENT_NAME))) {
      await workspace.fs.delete(
        URI.file(path.join(lwcDir, TEST_COMPONENT_NAME)),
        { recursive: true }
      );
      await waitForConfigUpdate(configPath);
    }

    if (fs.existsSync(path.join(lwcDir, CREATE_COMPONENT_NAME))) {
      await workspace.fs.delete(
        URI.file(path.join(lwcDir, CREATE_COMPONENT_NAME)),
        { recursive: true }
      );
      await waitForConfigUpdate(configPath);
    }
  });

  it('Should keep a generic c/* field in jsconfig after creating a new component', async () => {
    await createComponent(CREATE_COMPONENT_NAME, lwcDir);

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate, 'config should not be updated').to.be.false;

    const newConfig = await parseConfig(configPath);
    expect(config).to.eql(newConfig);
    expect(newConfig.paths).have.own.property(`c/*`);
  });

  it('Should not update jsconfig.json when a component is saved', async () => {
    const document = await workspace.openTextDocument(
      path.join(lwcDir, TEST_COMPONENT_NAME, `${TEST_COMPONENT_NAME}.js`)
    );

    await document.save();

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate, 'config should not be updated').to.be.false;

    const newConfig = await parseConfig(configPath);
    expect(config).to.eql(newConfig);
  });

  it('Should not update jsconfig.json on keystrokes in a component file', async () => {
    const document = await workspace.openTextDocument(
      path.join(lwcDir, TEST_COMPONENT_NAME, `${TEST_COMPONENT_NAME}.js`)
    );
    const editor = await window.showTextDocument(document);

    await editor.edit(editBuilder => {
      editBuilder.insert(new Position(0, 0), 'foo');
    });

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate, 'config should not be updated').to.be.false;

    const newConfig = await parseConfig(configPath);
    expect(config).to.eql(newConfig);
  });
});

/**
 * Helper to read and parse jsconfig.json
 *
 * @param configPath - path to jsconfig.json
 */
async function parseConfig(configPath: string) {
  return JSON.parse(
    (await workspace.fs.readFile(URI.file(configPath))).toString()
  );
}

/**
 * Helper to wait for jsconfig.json updates
 *
 * @param configPath - path to jsconfig.json
 * @returns value representing whether the config updated or the wait timed out
 */
function waitForConfigUpdate(configPath: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const watcher = workspace.createFileSystemWatcher(
      configPath,
      true,
      false,
      true
    );
    let timer: ReturnType<typeof setTimeout>;

    watcher.onDidChange(() => {
      watcher.dispose();
      clearTimeout(timer);
      resolve(true);
    });

    timer = setTimeout(() => {
      watcher.dispose();
      resolve(false);
    }, 500);
  });
}

/**
 * Helper to create a LWC component
 * Ideally, this should be replaced with invoking `sfdx.force.lightning.lwc.create`
 *
 * @param name - name of the new component
 * @param lwcDir - path for where to create the component
 */
async function createComponent(name: string, lwcDir: string) {
  await workspace.fs.createDirectory(URI.file(path.join(lwcDir, name)));

  const htmlEdit = new WorkspaceEdit();
  const jsEdit = new WorkspaceEdit();
  const xmlEdit = new WorkspaceEdit();

  htmlEdit.createFile(URI.file(path.join(lwcDir, name, `${name}.html`)));
  jsEdit.createFile(URI.file(path.join(lwcDir, name, `${name}.js`)));
  xmlEdit.createFile(URI.file(path.join(lwcDir, name, `${name}-meta.xml`)));

  await workspace.applyEdit(htmlEdit);
  await workspace.applyEdit(jsEdit);
  await workspace.applyEdit(xmlEdit);

  const encoder = new TextEncoder();

  await workspace.fs.writeFile(
    URI.file(path.join(lwcDir, name, `${name}.html`)),
    encoder.encode(`<template>
    <div>
      Hello, World!
    </div>
  </template>`)
  );

  await workspace.fs.writeFile(
    URI.file(path.join(lwcDir, name, `${name}.js`)),
    encoder.encode(
      `import { LightningElement } from 'lwc';
export default class ${name} extends LightningElement {}`
    )
  );

  await workspace.fs.writeFile(
    URI.file(path.join(lwcDir, name, `${name}-meta.xml`)),
    encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata" fqn="${name}">
      <apiVersion>46.0</apiVersion>
      <isExposed>false</isExposed>
  </LightningComponentBundle>`)
  );
}
