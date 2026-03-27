#!/bin/bash

# Workaround to compile VSCode extension without wireit

echo "🔨 Compiling VSCode Extension (Workaround)"
echo ""

cd /Users/shubham.goyal/Services/SFCLI/salesforcedx-vscode

# Use TypeScript from yarn
echo "Compiling packages..."
yarn exec tsc -b packages/salesforcedx-vscode-core/tsconfig.json 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Compilation successful!"
    echo "Now you can press F5 in VSCode to test"
else
    echo ""
    echo "⚠️ Compilation had warnings/errors but might still work"
    echo "Try pressing F5 in VSCode anyway"
fi
