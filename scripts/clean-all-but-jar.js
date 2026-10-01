#!/usr/bin/env node

const fs = require('fs');

// Removes all files but .jar files at the top-level
const files = fs.readdirSync('.');
files.forEach(file => {
  if (!file.match(/\.jar$/)) {
    try {
      if (fs.statSync(file).isDirectory()) {
        fs.rmSync(file, { recursive: true, force: true });
      } else {
        fs.unlinkSync(file);
      }
    } catch (err) {
      console.error(`Error removing ${file}:`, err);
    }
  }
});
