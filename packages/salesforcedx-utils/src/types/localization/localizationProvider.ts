export interface LocalizationProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localize(label: string, ...args: any[]): string;
}
