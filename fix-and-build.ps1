# PowerShell version of fix-package.bat
Write-Host "🔧 Fixing n8n-nodes-syncmate package..." -ForegroundColor Cyan

# Step 1: Create dist directory if missing
Write-Host "📁 Creating dist directory..."
New-Item -ItemType Directory -Force -Path "dist/nodes/WhatsAuto", "dist/credentials" | Out-Null

# Step 2: Create root index.js
Write-Host "📝 Creating root index.js..."
@"
// Entry point - required by n8n
module.exports = require('./dist/index.js');
"@ | Out-File -FilePath "index.js" -Encoding utf8

# Step 3: Create dist/index.js
Write-Host "📝 Creating dist/index.js..."
@"
// This file is generated during build
// It exports all nodes and credentials for n8n
module.exports = {};
"@ | Out-File -FilePath "dist/index.js" -Encoding utf8

# Step 4: Create .eslintrc.package.json
Write-Host "📝 Creating .eslintrc.package.json..."
@"
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
"@ | Out-File -FilePath ".eslintrc.package.json" -Encoding utf8

# Step 5: Check for pnpm
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Step 6: Install dependencies
Write-Host "📦 Installing dependencies..."
pnpm install

# Step 7: Build the package
Write-Host "🔨 Building package..."
pnpm run build

# Step 8: Pack the package
Write-Host "📦 Packing package..."
pnpm pack

# Step 9: Get the latest .tgz file
$tgzFile = Get-ChildItem *.tgz | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($tgzFile) {
    # Step 10: Scan the package
    Write-Host "🔍 Scanning package: $($tgzFile.Name)"
    npx @n8n/scan-community-package "$($tgzFile.FullName)"

    Write-Host "`n✅ Done! If scan passed, your package is ready." -ForegroundColor Green
    Write-Host "📦 Package file: $($tgzFile.Name)"
    Write-Host "`nTo install in n8n:"
    Write-Host "  npm install $($tgzFile.FullName)"
    
    Write-Host "`nTo run n8n with this node (development mode):" -ForegroundColor Cyan
    Write-Host "  `$env:N8N_CUSTOM_EXTENSIONS='$(Get-Location)\dist'; npx n8n start"
} else {
    Write-Error "Failed to create .tgz file."
}
