import { expect } from 'chai';
import { format } from 'util';
import { lwcComponentInputGuard } from '../../../../src/commands/util/inputGuard';
import { nls } from '../../../../src/messages';

const NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR = 'not_alphanumeric_or_underscore_error';
const NOT_START_WITH_LOWERCASE_ERROR = 'not_start_with_lowercase_error';
const END_WITH_UNDERSCORE_ERROR = 'end_with_underscore_error';
const HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR = 'has_two_consecutive_underscores_error';
const NOT_START_WITH_LETTER_ERROR = 'not_start_with_letter_error';

describe('inputGuard Unite Tests', () => {
  describe('LWC Component Name Input Guard', () => {
    it('should show the error message when component name does not start with a lowercase letter', () => {
      let exceptionThrown: any;
      const errorMessage = nls.localize(NOT_START_WITH_LOWERCASE_ERROR);
      try {
        lwcComponentInputGuard('_hello');
      } catch (e) {
        exceptionThrown = e;
      }
      expect(exceptionThrown.message).to.equal(errorMessage);
    });

    it('should show the error message when component name contains white space between letters', () => {

    });
  });
});
