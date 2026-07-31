# Deploy Firebase Realtime Database Rules
# This script deploys the database.rules.json to Firebase

Write-Host "Deploying Firebase Realtime Database Rules..." -ForegroundColor Green

# Check if Firebase CLI is installed
$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCmd) {
    Write-Host "Firebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

# Check if user is logged in
Write-Host "Checking Firebase authentication..." -ForegroundColor Cyan
$authCheck = firebase projects:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login to Firebase first:" -ForegroundColor Yellow
    Write-Host "  firebase login" -ForegroundColor White
    exit 1
}

# Deploy only database rules
Write-Host "Deploying database rules..." -ForegroundColor Cyan
firebase deploy --only database

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Database rules deployed successfully!" -ForegroundColor Green
    Write-Host "`nYour Realtime Database is now ready to use." -ForegroundColor Green
    Write-Host "Test it at: http://localhost:3000/test-realtime" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Deployment failed. Please check the errors above." -ForegroundColor Red
    exit 1
}