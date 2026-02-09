#!/usr/bin/env node

/**
 * Setup Required Directories for HiPro Commerce API
 * This script ensures all required directories exist with proper permissions
 */

const fs = require('fs');
const path = require('path');

function setupDirectories() {
  console.log('🏗️  Setting up required directories...');
  
  const directories = [
    'uploads',
    'uploads/payment-proofs',
    'uploads/products',
    'uploads/categories',
    'uploads/profiles'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`✅ Directory exists: ${dir}`);
      }
      
      // Test write permissions
      const testFile = path.join(dirPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`✅ Directory is writable: ${dir}`);
      
    } catch (error) {
      console.error(`❌ Error with directory ${dir}:`, error.message);
      
      if (error.code === 'EACCES') {
        console.log(`💡 Fix with: sudo chown -R $(whoami) ${dirPath}`);
        console.log(`💡 Or: sudo chmod 755 ${dirPath}`);
      }
    }
  });
  
  console.log('🎉 Directory setup complete!');
}

// Create .gitkeep files to ensure directories are committed
function createGitkeepFiles() {
  console.log('📝 Creating .gitkeep files...');
  
  const directories = [
    'uploads/payment-proofs',
    'uploads/products',
    'uploads/categories',
    'uploads/profiles'
  ];

  directories.forEach(dir => {
    const gitkeepPath = path.join(__dirname, dir, '.gitkeep');
    
    try {
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '# Keep this directory in git\n');
        console.log(`✅ Created .gitkeep: ${dir}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not create .gitkeep in ${dir}:`, error.message);
    }
  });
}

if (require.main === module) {
  setupDirectories();
  createGitkeepFiles();
}

module.exports = { setupDirectories, createGitkeepFiles };