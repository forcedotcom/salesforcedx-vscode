/**
 * ERROR HANDLING UTILITIES
 * THIS CAN BE REPLACED WITH IMPORT FROM SOQL_MODEL ( Fernando work )
 */
export enum ErrorType {
  UNKNOWN = 'UNKNOWN',
  EMPTY = 'EMPTY',
  NOSELECT = 'NOSELECT',
  NOSELECTIONS = 'NOSELECTIONS',
  NOFROM = 'NOFROM',
  INCOMPLETEFROM = 'INCOMPLETEFROM',
  INCOMPLETELIMIT = 'INCOMPLETELIMIT'
}

// recoverable field errors
export const recoverableFieldErrors = {};
recoverableFieldErrors[ErrorType.NOSELECT] = true;
recoverableFieldErrors[ErrorType.NOSELECTIONS] = true;
recoverableFieldErrors[ErrorType.EMPTY] = true;

// recoverable from errors
export const recoverableFromErrors = {};
recoverableFromErrors[ErrorType.INCOMPLETEFROM] = true;
recoverableFromErrors[ErrorType.NOFROM] = true;
recoverableFromErrors[ErrorType.EMPTY] = true;

// recoverable limit errors
export const recoverableLimitErrors = {};
recoverableLimitErrors[ErrorType.INCOMPLETELIMIT] = true;

// general recoverable errors
export const recoverableErrors = {
  ...recoverableFieldErrors,
  ...recoverableFromErrors,
  ...recoverableLimitErrors
};
recoverableErrors[ErrorType.EMPTY] = true;

// unrecoverable errors
export const unrecoverableErrors = {};
unrecoverableErrors[ErrorType.UNKNOWN] = true;

// END ERROR HANDLING UTLIITIES
