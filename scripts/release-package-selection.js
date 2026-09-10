const shouldUpdateVersion = packageJson =>
  !packageJson.versionedIndependently &&
  (Boolean(packageJson.scripts?.['vscode:publish']) ||
    (packageJson.private !== true && Boolean(packageJson.publishConfig)));

module.exports = { shouldUpdateVersion };
