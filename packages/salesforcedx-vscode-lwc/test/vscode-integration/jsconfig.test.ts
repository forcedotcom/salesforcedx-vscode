/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileSystemWatcher,
  Position,
  window,
  workspace,
  WorkspaceEdit
} from 'vscode';
import URI from 'vscode-uri';

const CONFIG_FILENAME = 'jsconfig.json';
const TEST_COMPONENT_NAME = 'testComponent';
const CREATE_COMPONENT_NAME = 'createComponent';

describe('jsconfig Test Suite', function() {
  let modulesDir: string;
  let configPath: string;
  let config: object;

  before(function() {
    modulesDir = path.join(
      workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );
    configPath = path.join(modulesDir, CONFIG_FILENAME);
  });

  beforeEach(async function() {
    this.timeout(15000);

    await createComponent(TEST_COMPONENT_NAME, modulesDir);
    await waitForConfigUpdate(configPath);
    config = await parseConfig(configPath);
  });

  afterEach(async function() {
    this.timeout(15000);

    if (fs.existsSync(path.join(modulesDir, TEST_COMPONENT_NAME))) {
      await workspace.fs.delete(
        URI.file(path.join(modulesDir, TEST_COMPONENT_NAME)),
        { recursive: true }
      );
      await waitForConfigUpdate(configPath);
    }

    if (fs.existsSync(path.join(modulesDir, CREATE_COMPONENT_NAME))) {
      await workspace.fs.delete(
        URI.file(path.join(modulesDir, CREATE_COMPONENT_NAME)),
        { recursive: true }
      );
      await waitForConfigUpdate(configPath);
    }
  });

  it('Should add the newly created component to the jsconfig compilerOptions paths map', async function() {
    this.timeout(15000);

    await createComponent(CREATE_COMPONENT_NAME, modulesDir);

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate).to.equal(true);

    const newConfig = await parseConfig(configPath);
    expect(config).not.to.eql(newConfig);
    expect(newConfig.compilerOptions.paths).have.own.property(
      `c/${CREATE_COMPONENT_NAME}`
    );
  });

  it('Should remove the deleted component from the jsconfig compilerOptions paths map', async function() {
    this.timeout(15000);

    await workspace.fs.delete(
      URI.file(path.join(modulesDir, TEST_COMPONENT_NAME)),
      { recursive: true }
    );

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate).to.equal(true);

    const newConfig = await parseConfig(configPath);
    expect(config).not.to.eql(newConfig);
    expect(newConfig.compilerOptions.paths).not.to.have.own.property(
      `c/${TEST_COMPONENT_NAME}`
    );
  });

  it('Should not update jsconfig.json when a component is saved', async function() {
    this.timeout(15000);

    const document = await workspace.openTextDocument(
      path.join(modulesDir, TEST_COMPONENT_NAME, `${TEST_COMPONENT_NAME}.js`)
    );

    await document.save();

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate).to.equal(false);

    const newConfig = await parseConfig(configPath);
    expect(config).to.eql(newConfig);
  });

  it('Should not update jsconfig.json on keystrokes in a component file', async function() {
    this.timeout(15000);

    const document = await workspace.openTextDocument(
      path.join(modulesDir, TEST_COMPONENT_NAME, `${TEST_COMPONENT_NAME}.js`)
    );
    const editor = await window.showTextDocument(document);

    await editor.edit(editBuilder => {
      editBuilder.insert(new Position(0, 0), 'foo');
    });

    const didUpdate = await waitForConfigUpdate(configPath);
    expect(didUpdate).to.equal(false);

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
async function waitForConfigUpdate(configPath: string): Promise<boolean> {
  return await new Promise<boolean>(resolve => {
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
    }, 5000);
  });
}

/**
 * Helper to create a LWC component
 * Ideally, this should be replaced with invoking `sfdx.force.lightning.lwc.create`
 *
 * @param name - name of the new component
 * @param modulesDir - path for where to create the component
 */
async function createComponent(name: string, modulesDir: string) {
  await workspace.fs.createDirectory(URI.file(path.join(modulesDir, name)));

  const htmlEdit = new WorkspaceEdit();
  const jsEdit = new WorkspaceEdit();
  const xmlEdit = new WorkspaceEdit();

  htmlEdit.createFile(URI.file(path.join(modulesDir, name, `${name}.html`)));
  jsEdit.createFile(URI.file(path.join(modulesDir, name, `${name}.js`)));
  xmlEdit.createFile(URI.file(path.join(modulesDir, name, `${name}-meta.xml`)));

  await workspace.applyEdit(htmlEdit);
  await workspace.applyEdit(jsEdit);
  await workspace.applyEdit(xmlEdit);

  const encoder = new TextEncoder();

  await workspace.fs.writeFile(
    URI.file(path.join(modulesDir, name, `${name}.html`)),
    encoder.encode(`<template>
    <div>
      Hello, World!
    </div>
  </template>`)
  );

  await workspace.fs.writeFile(
    URI.file(path.join(modulesDir, name, `${name}.js`)),
    encoder.encode(
      `import { LightningElement } from 'lwc';
export default class ${name} extends LightningElement {}`
    )
  );

  await workspace.fs.writeFile(
    URI.file(path.join(modulesDir, name, `${name}-meta.xml`)),
    encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata" fqn="${name}">
      <apiVersion>46.0</apiVersion>
      <isExposed>false</isExposed>
  </LightningComponentBundle>`)
  );
}
