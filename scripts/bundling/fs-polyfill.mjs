// FS polyfill wrapper as pure ESM for browser bundling
import * as fsPolyfill from '@salesforce/core/fs';

const fs = fsPolyfill.fs;

export default fs;
export const { fs: fsExport, getVirtualFs, setFs, resetFs } = fsPolyfill;
