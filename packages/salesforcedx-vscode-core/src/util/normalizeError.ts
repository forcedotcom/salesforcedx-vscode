export const normalizeError = (e: any): Error =>
  e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'Unknown error');