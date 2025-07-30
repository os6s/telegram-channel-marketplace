#!/usr/bin/env node

// Custom build script for Render deployment
// This ensures build tools are available regardless of PATH issues

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

console.log('🚀 Starting Render build process...');

// Function to run commands with proper error handling
function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

// Ensure we're in the right directory
console.log('📁 Working directory:', process.cwd());

// Check if node_modules exists
if (!existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  runCommand('npm install', 'Dependency installation');
}

// Check if vite is available in node_modules
const vitePath = path.join(process.cwd(), 'node_modules', '.bin', 'vite');
const esbuildPath = path.join(process.cwd(), 'node_modules', '.bin', 'esbuild');

console.log('🔍 Checking build tools...');
console.log('Vite path:', vitePath);
console.log('Esbuild path:', esbuildPath);

// Build frontend using direct path to vite
console.log('🎨 Building frontend...');
const viteCommand = existsSync(vitePath) 
  ? `"${vitePath}" build`
  : 'npx vite build';
runCommand(viteCommand, 'Frontend build');

// Build backend using direct path to esbuild
console.log('⚙️ Building backend...');
const esbuildCommand = existsSync(esbuildPath)
  ? `"${esbuildPath}" server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
  : 'npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist';
runCommand(esbuildCommand, 'Backend build');

console.log('🎉 Build completed successfully!');