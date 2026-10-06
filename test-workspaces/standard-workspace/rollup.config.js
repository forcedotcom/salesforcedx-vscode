/* eslint-env node */

const path = require('path');
const lwcCompiler = require('@lwc/rollup-plugin');

module.exports = {
    input: path.resolve('src/main.js'),
    output: {
        file: path.resolve('static/js/main.js'),
        format: 'iife',
    },
    plugins: [lwcCompiler()]
};
