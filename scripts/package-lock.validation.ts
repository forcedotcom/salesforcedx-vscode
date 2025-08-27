import lockfile from '../package-lock.json';
import assert from 'node:assert';

assert.deepStrictEqual(
  Object.entries(lockfile.packages)
    .filter(([key]) => key.startsWith('node_modules'))
    .filter(([, value]) => !('link' in value) && !('inBundle' in value))
    .filter(([, value]) => !('integrity' in value) || !('resolved' in value)),
  [],
  `integrity/resolved property is missing in package-lock.json.  see npm bug https://github.com/npm/cli/issues/4263.  copy the lockfile from the default branch and node_modules and re-run npm install.`
);
console.log('Package lock file is valid');
