# Safe Push Script for Hip Pro API
# This script ensures reliable pushing to remote repository

param(
    [string]$CommitMessage = "feat: update code changes",
    [string]$Branch = "main",
    [switch]$Force = $false
)

Write-Host "🚀 Safe Push Script for Hip Pro API" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Function to check if we're in a git repository
function Test-GitRepository {
    if (-not (Test-Path ".git")) {
        Write-Error "❌ Not a git repository. Please run this script from the repository root."
        exit 1
    }
}

# Function to ensure .env files are not tracked
function Protect-SensitiveFiles {
    Write-Host "🛡️  Checking for sensitive files..." -ForegroundColor Yellow
    
    # Check if any .env files are staged
    $envFiles = git diff --cached --name-only | Where-Object { $_ -match '\.env' }
    if ($envFiles) {
        Write-Host "⚠️  Found staged .env files. Removing from staging..." -ForegroundColor Red
        git reset HEAD $envFiles
        Write-Host "✅ Sensitive files removed from staging" -ForegroundColor Green
    }
    
    # Ensure .gitignore includes common sensitive patterns
    $gitignoreContent = @"
# Environment files
.env
.env.local
.env.development
.env.staging
.env.production
.env.backup

# Secrets and credentials
*.key
*.pem
*.p12
secrets.json
credentials.json

# IDE and OS files
.vscode/settings.json
.idea/
*.swp
*.swo
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
temp/
tmp/
"@

    if (Test-Path ".gitignore") {
        $currentIgnore = Get-Content ".gitignore" -Raw
        if (-not $currentIgnore.Contains(".env.development")) {
            Add-Content ".gitignore" "`n$gitignoreContent"
            Write-Host "✅ Updated .gitignore with security patterns" -ForegroundColor Green
        }
    } else {
        Set-Content ".gitignore" $gitignoreContent
        Write-Host "✅ Created .gitignore with security patterns" -ForegroundColor Green
    }
}

# Function to configure git settings
function Set-GitConfiguration {
    Write-Host "⚙️  Configuring git settings..." -ForegroundColor Yellow
    
    git config push.default simple
    git config pull.rebase false
    git config credential.helper manager-core
    git config core.autocrlf true
    git config core.filemode false
    git config branch.$Branch.remote origin
    git config branch.$Branch.merge refs/heads/$Branch
    
    Write-Host "✅ Git configuration updated" -ForegroundColor Green
}

# Function to safely commit changes
function Invoke-SafeCommit {
    Write-Host "📝 Preparing commit..." -ForegroundColor Yellow
    
    # Check if there are changes to commit
    $changes = git diff --name-only
    $stagedChanges = git diff --cached --name-only
    
    if (-not $changes -and -not $stagedChanges) {
        Write-Host "ℹ️  No changes to commit" -ForegroundColor Blue
        return $false
    }
    
    # Stage all changes if nothing is staged
    if (-not $stagedChanges -and $changes) {
        git add .
        Write-Host "✅ Staged all changes" -ForegroundColor Green
    }
    
    # Create commit
    do {
        try {
            git commit -m $CommitMessage
            Write-Host "✅ Commit created successfully" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "⚠️  Commit failed. Retrying..." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    } while ($true)
}

# Function to safely push to remote
function Invoke-SafePush {
    Write-Host "🚀 Pushing to remote..." -ForegroundColor Yellow
    
    $maxRetries = 3
    $retryCount = 0
    
    do {
        try {
            if ($Force) {
                git push --force-with-lease origin $Branch
            } else {
                # Try normal push first
                $pushResult = git push origin $Branch 2>&1
                if ($LASTEXITCODE -ne 0) {
                    # If push fails, try to pull and merge first
                    Write-Host "⚠️  Push rejected. Trying to pull first..." -ForegroundColor Yellow
                    git pull origin $Branch --no-rebase
                    git push origin $Branch
                }
            }
            
            Write-Host "✅ Push completed successfully!" -ForegroundColor Green
            return $true
        }
        catch {
            $retryCount++
            Write-Host "⚠️  Push failed (attempt $retryCount/$maxRetries). Retrying..." -ForegroundColor Yellow
            
            if ($retryCount -ge $maxRetries) {
                Write-Host "❌ Push failed after $maxRetries attempts" -ForegroundColor Red
                Write-Host "💡 Try running with -Force switch if you need to overwrite remote history" -ForegroundColor Blue
                return $false
            }
            
            Start-Sleep -Seconds 2
        }
    } while ($retryCount -lt $maxRetries)
}

# Main execution
try {
    Test-GitRepository
    Protect-SensitiveFiles
    Set-GitConfiguration
    
    $commitCreated = Invoke-SafeCommit
    if ($commitCreated -or (git log origin/$Branch..HEAD --oneline)) {
        $pushSuccess = Invoke-SafePush
        if ($pushSuccess) {
            Write-Host "🎉 All operations completed successfully!" -ForegroundColor Green
            Write-Host "📊 Repository status:" -ForegroundColor Cyan
            git status --short --branch
        }
    } else {
        Write-Host "ℹ️  Nothing to push. Repository is up to date." -ForegroundColor Blue
    }
}
catch {
    Write-Host "❌ Script failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}