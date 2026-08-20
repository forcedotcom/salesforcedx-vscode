const shouldUpdateVersion = packageJson =>
  packageJson.private !== true &&
  !packageJson.versionedIndependently &&
  (Boolean(packageJson.scripts?.['vscode:publish']) || Boolean(packageJson.publishConfig));

module.exports = { shouldUpdateVersion };
