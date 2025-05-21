const { exec } = require('child_process');

exec('npm run vscode:bundle', (error, stdout, stderr) => {
  // Combine stdout and stderr to check the entire output
  const output = `${stdout}\n${stderr}`;

  // Always show the full output for debugging
  console.log('Full build output:');
  console.log(output);

  if (error) {
    console.error('Build failed with error:');
    console.error(error);
    process.exit(1); // Exit with an error code
  }

  // Check if the output contains the error string
  if (output.includes('[require-resolve-not-external]')) {
    console.error('\nError: A dependency that has to be externalized in esbuild process is found.');
    console.error('Please check the output above for the specific dependency that needs to be externalized.');
    process.exit(2); // Exit with an error code
  } else {
    console.log('\nBuild completed successfully');
    process.exit(0); // Exit with success code
  }
});
