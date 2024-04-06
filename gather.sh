#!/bin/bash

# Directory where the search will begin
SOURCE_DIR="./packages" # Replace with your source directory path

# Directory where the .vsix files will be copied
TARGET_DIR="./extensions" # Replace with your target directory path

# Create the target directory if it doesn't exist
# mkdir -p "$TARGET_DIR"

# Find and copy .vsix files
find "$SOURCE_DIR" -type d -name 'salesforcedx-vscode*' -print0 | while IFS= read -r -d '' dir; do
    find "$dir" -name '*60.7.0.vsix' -exec cp {} "$TARGET_DIR" \;
done

echo "All .vsix files have been copied to $TARGET_DIR."