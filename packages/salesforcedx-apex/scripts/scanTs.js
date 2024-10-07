const fs = require('fs');
const path = require('path');
const { Project, CallExpression } = require('ts-morph');

const SRC_DIR = path.join(__dirname, '..', 'src');
const project = new Project({
  tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
});

let detected = false;

const scanDirectory = (dir) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      analyzeFile(fullPath);
    }
  });
};

// This function will detect all the usages of fs.read* and send warnings with the location of the usage
const analyzeFile = (filePath) => {
  const srcFile = project.addSourceFileAtPath(filePath);
  const funcCalls = srcFile.getDescendantsOfKind(CallExpression);

  funcCalls.forEach((callExpression) => {
    const exp = callExpression.getExpression();
    if (exp.getText().startsWith('fs.read')) {
      detected = true;
      console.warn(
        `Warning: Usage of "${exp.getText()}" in file "${filePath}" at line ${callExpression.getStartLineNumber()}.\n`
      );
    }
  });
};

scanDirectory(SRC_DIR);

if (detected) {
  console.log('The warnings above do not mean the usages are wrong.');
  console.log(`Avoid reading local artifacts with "fs.read*" since esbuild cannot bundle the artifacts together.`);
  console.log('Consider using import instead or reach out to IDEx Foundations team');
} else {
  console.log('No fs.read* usages detected.');
}

console.log('Scan complete');