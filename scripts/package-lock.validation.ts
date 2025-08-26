import lockfile from '../package-lock.json';

Object.entries(lockfile.packages)
  .filter(([key, value]) => key.startsWith('node_modules') && !('link' in value) && !('inBundle' in value))
  .filter(([key, value]) => !('integrity' in value) || !('resolved' in value))
  .map(([key], i, arr) => {
    throw new Error(
      `integrity/resolved property is missing for ${key} and ${arr.length - i} others.  see npm bug https://github.com/npm/cli/issues/4263.  copy the lockfile from the default branch and node_modules and re-run npm install.`
    );
  });

console.log('Package lock file is valid');
