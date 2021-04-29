#!/bin/sh
set -e  # exit on failure
echo "----- Deleting from ${HOME}/Library/..."
rm -rf $HOME/Library/Application\ Support/Code
echo "----- Deleting all installed extensions"
rm -rf $HOME/.vscode
echo "----- Delete reference on Applications folder"
rm -rf /Applications/Visual\ Studio\ Code.app
echo "You have successfully removed VSCode from your machine !!"
echo "You can download and install it from https://code.visualstudio.com/download"