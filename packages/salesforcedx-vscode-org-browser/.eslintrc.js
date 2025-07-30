module.exports = {
  overrides: [
    {
      files: ['playwright.web.config.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off'
      }
    }
  ]
};
