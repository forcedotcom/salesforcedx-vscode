const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Source pattern to find all coverage-final.json files
const sourcePattern = './packages/**/coverage/coverage-final.json';

// Get the output directory from the command line arguments or default to 'coverage'
const outputDir = process.argv[2] || 'coverage';

// Destination file
const destinationFile = path.join(outputDir, 'combined-coverage-final.json');

// Function to merge coverage files
function mergeCoverageFiles() {
  // Find all coverage-final.json files
  const files = glob.sync(sourcePattern);

  // Initialize an empty object to hold the combined coverage data
  let combinedCoverage = {};

  files.forEach(file => {
    // Read the coverage data from the file
    const coverageData = JSON.parse(fs.readFileSync(file, 'utf8'));

    // Merge the coverage data into the combinedCoverage object
    combinedCoverage = { ...combinedCoverage, ...coverageData };

    console.log(`Merged ${file}`);
  });

  // Ensure the destination directory exists
  fs.mkdirSync(path.dirname(destinationFile), { recursive: true });

  // Write the combined coverage data to the destination file
  fs.writeFileSync(destinationFile, JSON.stringify(combinedCoverage, null, 2));

  console.log(`Combined coverage written to ${destinationFile}`);
}

// Run the function
mergeCoverageFiles();
