#!/bin/bash

# Safe Push Script for Hip Pro API
# This script ensures reliable pushing to remote repository

COMMIT_MESSAGE="${1:-feat: update code changes}"
BRANCH="${2:-main}"
FORCE_PUSH="${3:-false}"

echo "🚀 Safe Push Script for Hip Pro API"
echo "==============================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Please run this script from the repository root."
    exit 1
fi

# Function to protect sensitive files
protect_sensitive_files() {
    echo "🛡️  Checking for sensitive files..."
    
    # Check if any .env files are staged
    env_files=$(git diff --cached --name-only | grep '\.env' || true)
    if [ -n "$env_files" ]; then
        echo "⚠️  Found staged .env files. Removing from staging..."
        git reset HEAD $env_files
        echo "✅ Sensitive files removed from staging"
    fi
    
    # Ensure .gitignore includes sensitive patterns
    if ! grep -q ".env.development" .gitignore 2>/dev/null; then
        cat >> .gitignore << 'EOF'

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
EOF
        echo "✅ Updated .gitignore with security patterns"
    fi
}

# Function to configure git settings
configure_git() {
    echo "⚙️  Configuring git settings..."
    
    git config push.default simple
    git config pull.rebase false
    git config core.autocrlf true
    git config core.filemode false
    git config branch.$BRANCH.remote origin
    git config branch.$BRANCH.merge refs/heads/$BRANCH
    
    echo "✅ Git configuration updated"
}

# Function to safely commit changes
safe_commit() {
    echo "📝 Preparing commit..."
    
    # Check if there are changes to commit
    if [ -z "$(git diff --name-only)" ] && [ -z "$(git diff --cached --name-only)" ]; then
        echo "ℹ️  No changes to commit"
        return 1
    fi
    
    # Stage all changes if nothing is staged
    if [ -z "$(git diff --cached --name-only)" ] && [ -n "$(git diff --name-only)" ]; then
        git add .
        echo "✅ Staged all changes"
    fi
    
    # Create commit
    git commit -m "$COMMIT_MESSAGE"
    echo "✅ Commit created successfully"
    return 0
}

# Function to safely push to remote
safe_push() {
    echo "🚀 Pushing to remote..."
    
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if [ "$FORCE_PUSH" = "true" ]; then
            if git push --force-with-lease origin $BRANCH; then
                echo "✅ Force push completed successfully!"
                return 0
            fi
        else
            if git push origin $BRANCH; then
                echo "✅ Push completed successfully!"
                return 0
            else
                echo "⚠️  Push rejected. Trying to pull first..."
                git pull origin $BRANCH --no-rebase && git push origin $BRANCH && {
                    echo "✅ Push completed after pull!"
                    return 0
                }
            fi
        fi
        
        retry_count=$((retry_count + 1))
        echo "⚠️  Push failed (attempt $retry_count/$max_retries). Retrying..."
        sleep 2
    done
    
    echo "❌ Push failed after $max_retries attempts"
    return 1
}

# Main execution
protect_sensitive_files
configure_git

if safe_commit || [ -n "$(git log origin/$BRANCH..HEAD --oneline 2>/dev/null)" ]; then
    if safe_push; then
        echo "🎉 All operations completed successfully!"
        echo "📊 Repository status:"
        git status --short --branch
    fi
else
    echo "ℹ️  Nothing to push. Repository is up to date."
fi