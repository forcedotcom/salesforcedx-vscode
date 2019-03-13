/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Range, window, workspace } from 'vscode';
import {
  CodeCoverage,
  getLineRange
} from '../../../src/codecoverage/colorizer';
import { StatusBarToggle } from '../../../src/codecoverage/statusBarToggle';

describe('Code coverage colorizer', () => {
  it('Should report correct status on statusbaritem', async () => {
    const statusBarToggle = new StatusBarToggle();
    const colorizer = new CodeCoverage(statusBarToggle);

    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    colorizer.toggleCoverage();
    expect(statusBarToggle.isHighlightingEnabled).to.equal(true);
    colorizer.toggleCoverage();
    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
  });

  it('Should report correct covered and uncovered lines for apex with code coverage', async () => {
    const testCoverage = await workspace.findFiles('**/DemoController.cls');
    const testDocument = await workspace.openTextDocument(testCoverage[0]);
    await window.showTextDocument(testDocument);

    const statusBarToggle = new StatusBarToggle();
    const colorizer = new CodeCoverage(statusBarToggle);

    expect(statusBarToggle.isHighlightingEnabled).to.equal(false);
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.coveredLines).to.be.empty;
    // tslint:disable-next-line:no-unused-expression
    expect(colorizer.uncoveredLines).to.be.empty;

    colorizer.toggleCoverage();
    expect(colorizer.coveredLines.length).to.equal(6);
    expect(colorizer.uncoveredLines.length).to.equal(1);
    const uncovered = Array<Range>();
    uncovered.push(getLineRange(testDocument, 5));
    expect(uncovered).to.deep.equal(colorizer.uncoveredLines);
    const covered = Array<Range>();
    covered.push(getLineRange(testDocument, 10));
    covered.push(getLineRange(testDocument, 12));
    covered.push(getLineRange(testDocument, 14));
    covered.push(getLineRange(testDocument, 16));
    covered.push(getLineRange(testDocument, 19));
    covered.push(getLineRange(testDocument, 27));
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
    const testApex = await workspace.findFiles('**/DemoControllerTest.cls');
    const testDocument = await workspace.openTextDocument(testApex[0]);
    await window.showTextDocument(testDocument);

    const statusBarToggle = new StatusBarToggle();
    const colorizer = new CodeCoverage(statusBarToggle);

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
