#!/bin/bash

# Quick fix script for n8n-nodes-syncmate package
echo "🔧 Fixing n8n-nodes-syncmate package..."

# Step 1: Create dist directory if missing
echo "📁 Creating dist directory..."
mkdir -p dist
mkdir -p dist/nodes/WhatsAuto
mkdir -p dist/credentials

# Step 2: Create root index.js
echo "📝 Creating root index.js..."
cat > index.js << 'EOF'
// Entry point - required by n8n
module.exports = require('./dist/index.js');
EOF

# Step 3: Create dist/index.js
echo "📝 Creating dist/index.js..."
cat > dist/index.js << 'EOF'
// This file is generated during build
// It exports all nodes and credentials for n8n
module.exports = {};
EOF

# Step 4: Create .eslintrc.package.json if missing
echo "📝 Creating .eslintrc.package.json..."
cat > .eslintrc.package.json << 'EOF'
{
  "root": true,
  "env": {
    "node": true
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": ["./tsconfig.json"],
    "sourceType": "module",
    "ecmaVersion": 2022
  },
  "plugins": ["n8n-nodes-base"],
  "extends": ["plugin:n8n-nodes-base/community"],
  "rules": {
    "n8n-nodes-base/node-class-description-inputs-wrong-regular-node": "error",
    "n8n-nodes-base/node-class-description-outputs-wrong": "error"
  }
}
EOF

# Step 5: Install pnpm if not installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Step 6: Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Step 7: Build the package
echo "🔨 Building package..."
pnpm run build

# Step 8: Pack the package
echo "📦 Packing package..."
pnpm pack

# Step 9: Get the latest .tgz file
TGZ_FILE=$(ls -t *.tgz | head -1)

# Step 10: Scan the package
echo "🔍 Scanning package: $TGZ_FILE"
npx @n8n/scan-community-package "$TGZ_FILE"

echo ""
echo "✅ Done! If scan passed, your package is ready."
echo "📦 Package file: $TGZ_FILE"
echo ""
echo "To install in n8n:"
echo "  npm install $PWD/$TGZ_FILE"