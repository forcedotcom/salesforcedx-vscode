module.exports = {
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  parse: require('url').parse,
  resolve: require('url').resolve,
  resolveObject: require('url').resolveObject,
  format: require('url').format,
  domainToASCII: require('url').domainToASCII,
  domainToUnicode: require('url').domainToUnicode,
  pathToFileURL: require('url').pathToFileURL,
  fileURLToPath: require('url').fileURLToPath,
  urlToHttpOptions: require('url').urlToHttpOptions
};
