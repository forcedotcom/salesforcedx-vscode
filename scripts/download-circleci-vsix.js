#!/usr/bin/env node

const {
  buildHTTPOpts,
  buildVsixUrl,
  download,
  getVsixName,
  httpsGet
} = require('./publish-utils');

const buildNum = process.env['CIRCLECI_BUILD_NUM'];
const circleciToken = process.env['CIRCLECI_TOKEN'];
const opts = buildHTTPOpts(buildNum, circleciToken);

httpsGet(opts).then(jsonData => {
  if (jsonData.length > 0) {
    console.log(`VSIXs to be downloaded : ${jsonData.length}`);
  }

  for (let i = 0; i < jsonData.length; i++) {
    const vsixName = getVsixName(jsonData[i]);
    const optsDownload = buildVsixUrl(jsonData[i]);
    console.log('vsix ===> ', vsixName);
    download(vsixName, optsDownload)
      .then(resultArray => {
        console.log('download was successful', resultArray);
        // extract(resultArray[0], resultArray[1], isInsiders);
      })
      .catch(err => {
        error(err.message);
      });
  }
});
