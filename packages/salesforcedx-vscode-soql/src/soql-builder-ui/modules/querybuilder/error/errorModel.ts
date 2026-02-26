import { ErrorType } from '@salesforce/soql-model/model/model';

/** ERROR HANDLING UTILITIES - Using ErrorType from soql-model */

// recoverable field errors
export const recoverableFieldErrors: Partial<Record<ErrorType, boolean>> = {
  NOSELECT: true,
  NOSELECTIONS: true,
  EMPTY: true
};

// recoverable from errors
export const recoverableFromErrors: Partial<Record<ErrorType, boolean>> = {
  INCOMPLETEFROM: true,
  NOFROM: true,
  EMPTY: true
};

// recoverable limit errors
export const recoverableLimitErrors: Partial<Record<ErrorType, boolean>> = {
  INCOMPLETELIMIT: true
};

// general recoverable errors
export const recoverableErrors: Partial<Record<ErrorType, boolean>> = {
  ...recoverableFieldErrors,
  ...recoverableFromErrors,
  ...recoverableLimitErrors,
  EMPTY: true
};

// unrecoverable errors
export const unrecoverableErrors: Partial<Record<ErrorType, boolean>> = {
  UNKNOWN: true
};
