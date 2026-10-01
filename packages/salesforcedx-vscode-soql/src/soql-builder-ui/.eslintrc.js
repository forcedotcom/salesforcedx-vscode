module.exports = {
  extends: ['@salesforce/eslint-config-lwc/base'],
  overrides: [
    {
      files: ['*.test.js'],
      rules: {
        '@lwc/lwc/no-unexpected-wire-adapter-usages': 'off'
      }
    }
  ]
};
