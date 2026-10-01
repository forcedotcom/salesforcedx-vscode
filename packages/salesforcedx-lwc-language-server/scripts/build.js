#!/usr/bin/env node
const { cpSync } = require('node:fs');
const { join } = require('node:path');

//Copy src/resources into out/src/
cpSync('src/resources', join('out', 'src', 'resources'), { recursive: true });
