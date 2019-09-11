const https = require('https');
const fs = require('fs');
const jsdom = require('jsdom');
const prettier = require('prettier');
const { JSDOM } = jsdom;

const download = function(url, cb) {
  https
    .get(url, resp => {
      let data = '';
      resp.on('data', chunk => {
        data += chunk;
      });
      resp.on('end', () => {
        cb(null, JSON.parse(data));
      });
    })
    .on('error', err => {
      cb(err);
    });
};

const getExternalHtml = function(url, cb) {
  download(url, function(err, data) {
    if (err) {
      throw err;
    }
    const dom = new JSDOM(data.html);
    cb(dom);
  });
};

const writeFile = function(dest, html) {
  html = prettier.format(html, { parser: 'html' });
  fs.writeFileSync(dest, html, 'utf8');
};

getExternalHtml(
  'https://developer.salesforce.com/sections/dsc-head.json',
  function(dom) {
    const html = dom.window.document.querySelector('div > div').innerHTML;
    writeFile('../docs/_includes/head.html', html);
  }
);

getExternalHtml(
  'https://developer.salesforce.com/sections/dsc-header.json',
  function(dom) {
    let html = dom.window.document.querySelector('header').outerHTML;
    html = html.replace('"=""', ''); // HACK: There is some invalid HTML in this file
    writeFile('../docs/_includes/header.html', html);
  }
);

getExternalHtml(
  'https://developer.salesforce.com/sections/dsc-footer.json',
  function(dom) {
    const html = dom.window.document.querySelector('footer').outerHTML;
    writeFile('../docs/_includes/footer.html', html);
  }
);
