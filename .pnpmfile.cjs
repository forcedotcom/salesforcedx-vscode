const { enforceRootInstall } = require('./scripts/require-root-install');

module.exports = {
  hooks: {
    updateConfig: config => {
      enforceRootInstall(process.cwd());
      return config;
    }
  }
};
