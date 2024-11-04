const { exec } = require('child_process');

exec('npm run vscode:bundle', (error, stdout, stderr) => {
  // Combine stdout and stderr to check the entire output
  const output = `${stdout}\n${stderr}`;
  if (error) {
    console.error(stderr);
    process.exit(1); // Exit with an error code
  }
  // Check if the output contains the error string
  if (output.includes('[require-resolve-not-external]')) {
    console.error(output);
    console.error('Error: A dependency that has to be externalized in esbuild process is found. Please resolve it!');
    process.exit(1); // Exit with an error code
  } else {
    console.log(output);
    process.exit(0); // Exit with success code
  }
});
