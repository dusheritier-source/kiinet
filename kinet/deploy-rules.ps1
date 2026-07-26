# Deploy Firestore Rules Script
# Run this script to deploy the Firestore security rules

Write-Host "=== Deploying Firestore Security Rules ===" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue

if (-not $firebaseInstalled) {
    Write-Host "Firebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
    Write-Host ""
}

# Check if user is logged in
Write-Host "Checking Firebase login status..." -ForegroundColor Cyan
$loginCheck = firebase login:list 2>&1

if ($LASTEXITCODE -ne 0 -or $loginCheck -match "No users logged in") {
    Write-Host "Please login to Firebase..." -ForegroundColor Yellow
    firebase login
    Write-Host ""
}

# Deploy Firestore rules
Write-Host "Deploying Firestore rules..." -ForegroundColor Cyan
firebase deploy --only firestore:rules

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Test your app at /signup and /login" -ForegroundColor Cyan