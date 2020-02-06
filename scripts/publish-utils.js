#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const url = require('url');

module.exports = {
  httpsGet: opts => {
    return new Promise((resolve, reject) => {
      // Set up the request.
      let respData = '';
      const req = https.request(opts, res => {
        res.setEncoding('utf8');
        res.on('data', chunk => {
          respData += chunk;
        });

        // get data from response.
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(respData));
          } else {
            // console.log('seems it was not 200, response = ', respData);
            reject('request status = ' + res.statusCode);
          }
        }); // end
      });

      req.on('error', e => {
        error(`Error on https request : ${e.message}`);
        reject('problems with request');
      });

      // write data to request body
      req.write('data\n');
      req.write('data\n');
      req.end();
    }); //end Promise
  },

  download: (fileName, optsDownload) => {
    return new Promise((resolve, reject) => {
      const pkgName = fileName.replace('-47.18.0.vsix', '');
      const tmpFilePath = path.resolve('packages', pkgName, fileName);
      console.log('download file path ====> ', tmpFilePath);
      const file = fs.createWriteStream(tmpFilePath);
      const req = https.get(optsDownload, res => {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve([tmpFilePath, fileName]);
        });
      });

      req.on('error', e => {
        error(`Error on vsix download : ${e.message}`);
        reject('problems downloading a vsix');
      });
      req.end();
    }); //end Promise
  },
  buildHTTPOpts: (buildNum, cciToken) => {
    // https://circleci.com/docs/2.0/artifacts/#downloading-all-artifacts-for-a-build-on-circleci
    return {
      host: 'circleci.com',
      path: `/api/v1.1/project/github/forcedotcom/salesforcedx-vscode/${buildNum}/artifacts?circle-token=${cciToken}`,
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    };
  },
  getVsixName: data => {
    return data.path.replace('extensions/', '');
  },
  buildVsixUrl: data => {
    const artifactUrl = new url.parse(data.url);
    return {
      host: artifactUrl.host,
      path: artifactUrl.pathname,
      method: 'GET'
    };
  }
};
