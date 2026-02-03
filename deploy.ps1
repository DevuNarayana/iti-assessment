# Deploy Script (PowerShell Version)

$htmlFile = "index.html"
$jsFile = "script.js"

# Function to get current version
function Get-CurrentVersion {
    param ($content)
    if ($content -match "Version (\d+)\.0") {
        return [int]$matches[1]
    }
    return 0
}

Write-Host "Starting Deployment Process..." -ForegroundColor Cyan

# 1. Read Current Version
if (Test-Path $htmlFile) {
    $htmlContent = Get-Content $htmlFile -Raw
    $currentVer = Get-CurrentVersion -content $htmlContent
} else {
    Write-Error "index.html not found!"
    exit 1
}

if ($currentVer -eq 0) {
    Write-Error "Could not determine current version."
    exit 1
}

$nextVer = $currentVer + 1
Write-Host "Current Version: $currentVer.0" -ForegroundColor Yellow
Write-Host "Target Version:  $nextVer.0" -ForegroundColor Green

# 2. Update Files
function Update-File {
    param ($path, $oldVer, $newVer)
    $content = Get-Content $path -Raw
    
    # Replace Version string
    $content = $content -replace "Version $oldVer\.0", "Version $newVer.0"
    # Replace CSS param
    $content = $content -replace "v=$oldVer\.0", "v=$newVer.0"
    
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Updated $path"
}

Update-File -path $htmlFile -oldVer $currentVer -newVer $nextVer
Update-File -path $jsFile -oldVer $currentVer -newVer $nextVer

# 3. Git Operations
$gitPath = "C:\Program Files\Git\cmd\git.exe"

Write-Host "`nStaging changes..." -ForegroundColor Cyan
& $gitPath add .

Write-Host "Committing..." -ForegroundColor Cyan
& $gitPath commit -m "Update: Version $nextVer.0"

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
& $gitPath push origin main

Write-Host "`nSUCCESS! Deployed Version $nextVer.0" -ForegroundColor Green
