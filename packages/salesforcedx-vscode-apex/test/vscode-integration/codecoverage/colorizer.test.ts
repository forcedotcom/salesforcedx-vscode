/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Range, RelativePattern, Uri, window, workspace } from 'vscode';
import { CodeCoverageHandler, getLineRange } from '../../../src/codecoverage/colorizer';
import { StatusBarToggle } from '../../../src/codecoverage/statusBarToggle';

describe('Code coverage colorizer', () => {
  let testCoverage: Uri[];

  beforeEach(async () => {
    testCoverage = await workspace.findFiles(
      new RelativePattern(workspace.workspaceFolders![0], '**/DemoController.cls'),
      new RelativePattern(workspace.workspaceFolders![0], '**/DemoControllerTest.cls')
    );
  });

  it('Should report correct status on statusbaritem', async () => {
    const statusBarToggle = new StatusBarToggle();
    const colorizer = new CodeCoverageHandler(statusBarToggle);

    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    colorizer.toggleCoverage();
    expect(statusBarToggle.isHighlightingEnabled).to.equal(true);
    colorizer.toggleCoverage();
    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
  });

  it('Should report correct covered and uncovered lines for apex with code coverage', async () => {
    const apexDocument = await workspace.openTextDocument(testCoverage[0]);
    await window.showTextDocument(apexDocument);

    const statusBarToggle = new StatusBarToggle();
    const colorizer = new CodeCoverageHandler(statusBarToggle);

    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    expect(colorizer.coveredLines).to.be.empty;
    expect(colorizer.uncoveredLines).to.be.empty;

    colorizer.toggleCoverage();
    expect(colorizer.coveredLines.length).to.equal(6);
    expect(colorizer.uncoveredLines.length).to.equal(1);
    const uncovered = Array<Range>();
    uncovered.push(getLineRange(apexDocument, 5));
    expect(uncovered).to.deep.equal(colorizer.uncoveredLines);
    const covered = Array<Range>();
    covered.push(getLineRange(apexDocument, 10));
    covered.push(getLineRange(apexDocument, 12));
    covered.push(getLineRange(apexDocument, 14));
    covered.push(getLineRange(apexDocument, 16));
    covered.push(getLineRange(apexDocument, 19));
    covered.push(getLineRange(apexDocument, 27));
    expect(covered).to.deep.equal(colorizer.coveredLines);
    expect(statusBarToggle.isHighlightingEnabled).to.equal(true);

    colorizer.toggleCoverage();
    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.coveredLines).to.be.empty;
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.uncoveredLines).to.be.empty;
  });

  it('Should report no lines for apex with out code coverage', async () => {
    const apexTestDoc = await workspace.openTextDocument(testCoverage[1]);
    await window.showTextDocument(apexTestDoc);

    const statusBarToggle = new StatusBarToggle();
    const colorizer = new CodeCoverageHandler(statusBarToggle);

    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.coveredLines).to.be.empty;
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.uncoveredLines).to.be.empty;

    colorizer.toggleCoverage();
    expect(colorizer.coveredLines.length).to.equal(0);
    expect(colorizer.uncoveredLines.length).to.equal(0);

    colorizer.toggleCoverage();
    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.coveredLines).to.be.empty;
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.uncoveredLines).to.be.empty;
  });
});
