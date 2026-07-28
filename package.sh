#!/bin/bash
# Fail the build instead of publishing whatever happens to be on disk. Without this, a compile
# error left the previous lib/ deleted and the copy step quietly skipped, and the script still
# exited 0.
set -euo pipefail

START_TIME=$SECONDS

echo "Building package..."
rm -rf lib
# Not bare `tsc`: node_modules/.bin is not on PATH when this script is invoked directly, which is
# how CI calls it.
pnpm exec tsc
rm -rf package
mkdir package

echo "Copying files..."
cp -r lib package/lib
cp package.json README.md LICENSE package

echo "Making package.json public..."
sed -i 's/"private": true/"private": false/' ./package/package.json

ELAPSED_TIME=$(($SECONDS - $START_TIME))
echo "Done in $ELAPSED_TIME seconds!"
