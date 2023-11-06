const getMessageFromError = (err: any): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err) {
    return `Unexpected error: ${JSON.stringify(err)}`;
  }
  return 'Unknown error';
};

export const utils = {
  getMessageFromError
};