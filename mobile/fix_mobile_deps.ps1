# Script de nettoyage et réinstallation forcée des dépendances Mobile
Write-Host "🧹 Nettoyage des fichiers temporaires..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue

Write-Host "🧼 Vidage du cache npm..." -ForegroundColor Cyan
npm cache clean --force

Write-Host "🚀 Réinstallation via miroir (npmmirror)..." -ForegroundColor Green
# Configuration du miroir pour cette session
$env:NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"
$env:NPM_CONFIG_FETCH_RETRIES=10
$env:NPM_CONFIG_FETCH_RETRY_FACTOR=10
$env:NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000
$env:NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=60000

npm install --legacy-peer-deps --prefer-offline

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Installation réussie !" -ForegroundColor Green
} else {
    Write-Host "❌ L'installation a encore échoué. Vérifiez votre connexion." -ForegroundColor Red
}
