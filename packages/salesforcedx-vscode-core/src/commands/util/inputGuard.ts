import { format } from 'util';
import { nls } from '../../messages';

const NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR = 'not_alphanumeric_or_underscore_error';
const NOT_START_WITH_LOWERCASE_ERROR = 'not_start_with_lowercase_error';
const END_WITH_UNDERSCORE_ERROR = 'end_with_underscore_error';
const HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR = 'has_two_consecutive_underscores_error';
const NOT_START_WITH_LETTER_ERROR = 'not_start_with_letter_error';

export function lwcComponentInputGuard(newName: string) {
  beginWithLowerCase(newName);
  hasAlphanumericOrUnderscore(newName);
  endWithUnderscore(newName);
  hasConsecutiveUnderscores(newName);
}

export function auraComponentInputGuard(newName: string) {
  beginWithLetter(newName);
  hasAlphanumericOrUnderscore(newName);
  endWithUnderscore(newName);
  hasConsecutiveUnderscores(newName);
}

function hasAlphanumericOrUnderscore(input: string) {
  const invalidPattern = /\W/;
  if (input.match(invalidPattern)) {
    showErrorMessage(NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR);
  }
}

function beginWithLowerCase(input: string) {
  const firstChar = input.charAt(0);
  if (!isLowerCase(firstChar)) {
    showErrorMessage(NOT_START_WITH_LOWERCASE_ERROR);
  }
}

function beginWithLetter(input: string) {
  const firstChar = input.charAt(0);
  if (!isLetter(firstChar)) {
    showErrorMessage(NOT_START_WITH_LETTER_ERROR);
  }
}

function endWithUnderscore(input: string) {
  const endChar = input.charAt(input.length - 1);
  if (endChar === '_') {
    showErrorMessage(END_WITH_UNDERSCORE_ERROR);
  }
}

function hasConsecutiveUnderscores(input: string) {
  if (input.indexOf('__') >= 0) {
    showErrorMessage(HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR);
  }
}

function isLowerCase(str: string): boolean {
  return str === str.toLowerCase() && str !== str.toUpperCase();
}

function isLetter(str: string): boolean {
  return Boolean(str.match(/[a-zA-Z]/));
}

function showErrorMessage(message: string) {
  const errorMessage = nls.localize(message);
  throw new Error(format(errorMessage));
}
