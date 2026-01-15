import { ErrorType } from '../../../../soql-model/errorTypes';

/** ERROR HANDLING UTILITIES - Using ErrorType from soql-model */

// recoverable field errors
export const recoverableFieldErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.NOSELECT]: true,
  [ErrorType.NOSELECTIONS]: true,
  [ErrorType.EMPTY]: true
};

// recoverable from errors
export const recoverableFromErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.INCOMPLETEFROM]: true,
  [ErrorType.NOFROM]: true,
  [ErrorType.EMPTY]: true
};

// recoverable limit errors
export const recoverableLimitErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.INCOMPLETELIMIT]: true
};

// general recoverable errors
export const recoverableErrors: Partial<Record<ErrorType, boolean>> = {
  ...recoverableFieldErrors,
  ...recoverableFromErrors,
  ...recoverableLimitErrors,
  [ErrorType.EMPTY]: true
};

// unrecoverable errors
export const unrecoverableErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.UNKNOWN]: true
};
