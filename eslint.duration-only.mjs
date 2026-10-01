import config from './eslint.config.mjs';

export default config.map(block =>
  block.rules
    ? {
        ...block,
        rules: block.rules['local/no-raw-duration']
          ? { 'local/no-raw-duration': block.rules['local/no-raw-duration'] }
          : {}
      }
    : block
);
