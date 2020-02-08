#!/usr/bin/env node
const path = require('path');

module.exports = {
  getVsixName: data => {
    return data.replace('extensions/', '');
  },

  getLocalPathForDownload: (fileName, pkgVersion) => {
    const pkgName = fileName.replace(`-${pkgVersion}.vsix`, '');
    return path.join('packages', pkgName, fileName);
  }
};
