import { expect } from 'chai';
import { auraComponentInputGuard, lwcComponentInputGuard } from '../../../../src/commands/util/inputGuard';
import { nls } from '../../../../src/messages';

const NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR = 'not_alphanumeric_or_underscore_error';
const NOT_START_WITH_LOWERCASE_ERROR = 'not_start_with_lowercase_error';
const END_WITH_UNDERSCORE_ERROR = 'end_with_underscore_error';
const HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR = 'has_two_consecutive_underscores_error';
const NOT_START_WITH_LETTER_ERROR = 'not_start_with_letter_error';

describe('inputGuard Unite Tests', () => {
  it('should not show the error message for a valid component name for LWC and Aura', () => {
    let exceptionThrownLwc: any;
    let exceptionThrownAura: any;

    try {
      lwcComponentInputGuard('hello');
    } catch (e) {
      exceptionThrownLwc = e;
    }
    try {
      auraComponentInputGuard('Hello');
    } catch (e) {
      exceptionThrownAura = e;
    }
    expect(exceptionThrownLwc).to.equal(undefined);
    expect(exceptionThrownAura).to.equal(undefined);
  });

  it('should show the error message when component name does not start with a lowercase letter for LWC', () => {
    let exceptionThrown: any;
    const errorMessage = nls.localize(NOT_START_WITH_LOWERCASE_ERROR);
    try {
      lwcComponentInputGuard('Hello');
    } catch (e) {
      exceptionThrown = e;
    }
    expect(exceptionThrown.message).to.equal(errorMessage);
  });

  it('should show the error message when component name does not start with a letter for Aura', () => {
    let exceptionThrown: any;
    const errorMessage = nls.localize(NOT_START_WITH_LETTER_ERROR);
    try {
      auraComponentInputGuard('_hello');
    } catch (e) {
      exceptionThrown = e;
    }
    expect(exceptionThrown.message).to.equal(errorMessage);
  });

  it('should show the error message when component name contains white space between letters for LWC and Aura', () => {
    let exceptionThrownLwc: any;
    let exceptionThrownAura: any;

    const errorMessage = nls.localize(NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR);
    try {
      lwcComponentInputGuard('hello  world');
    } catch (e) {
      exceptionThrownLwc = e;
    }
    try {
      auraComponentInputGuard('hello  world');
    } catch (e) {
      exceptionThrownAura = e;
    }
    expect(exceptionThrownLwc.message).to.equal(errorMessage);
    expect(exceptionThrownAura.message).to.equal(errorMessage);
  });

  it('should show the error message when component name contains special characters other than underscore or alphanumeric for LWC and Aura', () => {
    let exceptionThrownLwc: any;
    let exceptionThrownAura: any;

    const errorMessage = nls.localize(NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR);
    try {
      lwcComponentInputGuard('hello%$world');
    } catch (e) {
      exceptionThrownLwc = e;
    }
    try {
      auraComponentInputGuard('hello%$world');
    } catch (e) {
      exceptionThrownAura = e;
    }
    expect(exceptionThrownLwc.message).to.equal(errorMessage);
    expect(exceptionThrownAura.message).to.equal(errorMessage);
  });

  it('should show the error message when component name contains two consecutive underscores for LWC and Aura', () => {
    let exceptionThrownLwc: any;
    let exceptionThrownAura: any;

    const errorMessage = nls.localize(HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR);
    try {
      lwcComponentInputGuard('hello__world');
    } catch (e) {
      exceptionThrownLwc = e;
    }
    try {
      auraComponentInputGuard('hello__world');
    } catch (e) {
      exceptionThrownAura = e;
    }
    expect(exceptionThrownLwc.message).to.equal(errorMessage);
    expect(exceptionThrownAura.message).to.equal(errorMessage);
  });

  it('should show the error message when component name ends with an underscore for LWC and Aura', () => {
    let exceptionThrownLwc: any;
    let exceptionThrownAura: any;

    const errorMessage = nls.localize(END_WITH_UNDERSCORE_ERROR);
    try {
      lwcComponentInputGuard('hello_');
    } catch (e) {
      exceptionThrownLwc = e;
    }
    try {
      auraComponentInputGuard('hello_');
    } catch (e) {
      exceptionThrownAura = e;
    }
    expect(exceptionThrownLwc.message).to.equal(errorMessage);
    expect(exceptionThrownAura.message).to.equal(errorMessage);
  });
});
