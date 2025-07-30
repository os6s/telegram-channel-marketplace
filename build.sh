#!/bin/bash

# Build script for Render deployment
echo "Starting build process..."

# Ensure all dependencies are installed
npm install

# Check if vite is available
if ! command -v npx vite &> /dev/null; then
    echo "Installing vite globally as fallback..."
    npm install -g vite
fi

# Check if esbuild is available
if ! command -v npx esbuild &> /dev/null; then
    echo "Installing esbuild globally as fallback..."
    npm install -g esbuild
fi

# Run the build
echo "Building frontend..."
npx vite build

echo "Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Build completed successfully!"