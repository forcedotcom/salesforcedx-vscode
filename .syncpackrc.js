// https://github.com/JamieMason/syncpack#-configuration-file
{
  "semverGroups": [
    {
      // Exclude node and npm from pinning
      "range": "^",
      "dependencies": [
        "@types/node",
        "node",
        "npm"
      ],
      "packages": [
        "**"
      ]
    }
  ]
}
