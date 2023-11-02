/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { FrameStateUtil } from '../../../src/states/frameStateUtil';

// tslint:disable:no-unused-expression
describe('Frame state utilities', () => {
  describe('Verify frame name generation', () => {
    // EVENT_CODE_UNIT_STARTED/FINISHED tests
    it('EVENT_CODE_UNIT_STARTED only strips trigger prefix', () => {
      const fields = `NothingHereMatters|CODE_UNIT_STARTED|NothingHereMatters|__sfdc_trigger/Nothing/Here.Matters`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'Nothing/Here.Matters'
      );
    });
    it('EVENT_CODE_UNIT_FINISHED only strips trigger prefix', () => {
      const fields = `NothingHereMatters|CODE_UNIT_FINISHED|NothingHereMatters|__sfdc_trigger/Nothing/Here.Matters`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'Nothing/Here.Matters'
      );
    });
    it('EVENT_CODE_UNIT_STARTED nothing parsed if non-trigger', () => {
      const fields = `NothingHereMatters|CODE_UNIT_STARTED|NothingHereMatters|Nothing/Here.Matters`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'Nothing/Here.Matters'
      );
    });
    it('EVENT_CODE_UNIT_FINISHED nothing parsed if non-trigger', () => {
      const fields = `NothingHereMatters|CODE_UNIT_FINISHED|NothingHereMatters|Nothing/Here.Matters`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'Nothing/Here.Matters'
      );
    });
    // EVENT_CONSTRUCTOR_ENTRY/EXIT tests
    it('EVENT_CONSTRUCTOR_ENTRY simple class', () => {
      const fields = `NothingHereMatters|CONSTRUCTOR_ENTRY|NothingHereMatters|SomeClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'SomeClassName.SomeClassName'
      );
    });
    it('EVENT_CONSTRUCTOR_EXIT simple class', () => {
      const fields = `NothingHereMatters|CONSTRUCTOR_EXIT|NothingHereMatters|SomeClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'SomeClassName.SomeClassName'
      );
    });
    it('EVENT_CONSTRUCTOR_ENTRY inner class', () => {
      const fields = `NothingHereMatters|CONSTRUCTOR_ENTRY|NothingHereMatters|ClassName.InnerClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'ClassName.InnerClassName.InnerClassName'
      );
    });
    it('EVENT_CONSTRUCTOR_EXIT inner class', () => {
      const fields = `NothingHereMatters|CONSTRUCTOR_EXIT|NothingHereMatters|ClassName.InnerClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'ClassName.InnerClassName.InnerClassName'
      );
    });
    it('EVENT_CONSTRUCTOR_EXIT inner class', () => {
      const fields = `NothingHereMatters|CONSTRUCTOR_EXIT|NothingHereMatters|ClassName.InnerClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'ClassName.InnerClassName.InnerClassName'
      );
    });
    // VF_APEX_CALL_START/END tests
    it('EVENT_VF_APEX_CALL_START parse method name from invoke', () => {
      const fields = `NothingMattersHere|VF_APEX_CALL_START|NothingHereMatters|NothingHereMatters invoke(method)|ClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'ClassName.method()'
      );
    });
    it('EVENT_VF_APEX_CALL_END parse method name from invoke', () => {
      const fields = `NothingMattersHere|VF_APEX_CALL_END|NothingHereMatters|NothingHereMatters invoke(method)|ClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal(
        'ClassName.method()'
      );
    });
    it('EVENT_VF_APEX_CALL_START nothing parsed if not invoke', () => {
      const fields = `NothingMattersHere|VF_APEX_CALL_START|NothingHereMatters|NothingHereMatters notinvoke(method)|ClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal('ClassName');
    });
    it('EVENT_VF_APEX_CALL_END nothing parsed if not invoke', () => {
      const fields = `NothingMattersHere|VF_APEX_CALL_END|NothingHereMatters|NothingHereMatters notinvoke(method)|ClassName`.split(
        '|'
      );
      expect(FrameStateUtil.computeFrameName(fields)).to.equal('ClassName');
    });
  });
  // isExtraneousVFGetterOrSetterLogLine tests
  describe('Verify isExtraneousVFGetterOrSetterLogLine only matches the extraneous get/set log lines', () => {
    // Positive match cases - all should return true
    it('Bare Minimum Get Match returns true', () => {
      const logLinePiece = ` get(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(true);
    });
    it('Bare Minimum Set Match returns true', () => {
      const logLinePiece = ` set(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(true);
    });
    it('Non-invoke Get should return true', () => {
      const logLinePiece = `ThisPartOfTheStringShouldNotMatter get(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(true);
    });
    it('Non-invoke Set should return true', () => {
      const logLinePiece = `ThisPartOfTheStringShouldNotMatter set(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(true);
    });
    // Negative match cases - all should return false
    it('Malformed set returns false', () => {
      const logLinePiece = `set(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(false);
    });
    it('Malformed get returns false', () => {
      const logLinePiece = `get(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(false);
    });
    it('Anything not Get/Set should return false', () => {
      const logLinePiece = `ThisPartOfTheStringShouldNotMatter notgetorset(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(false);
    });
    it('Non-Get/Set should return false', () => {
      const logLinePiece = `ThisPartOfTheStringShouldNotMatter invoke(ThisPartOfTheStringShouldNotMatter)`;
      expect(
        FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(logLinePiece)
      ).to.equal(false);
    });
  });
});
