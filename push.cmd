@echo off
REM Safe Push Command for Windows
REM Usage: push.cmd [commit_message] [branch] [force]

setlocal
set "COMMIT_MSG=%~1"
set "BRANCH=%~2"
set "FORCE=%~3"

if "%COMMIT_MSG%"=="" set "COMMIT_MSG=feat: update code changes"
if "%BRANCH%"=="" set "BRANCH=main"

echo 🚀 Safe Push for Hip Pro API
echo ===============================================

REM Check if PowerShell script exists
if exist "scripts\safe-push.ps1" (
    echo Running PowerShell safe-push script...
    powershell.exe -ExecutionPolicy Bypass -File "scripts\safe-push.ps1" -CommitMessage "%COMMIT_MSG%" -Branch "%BRANCH%" %FORCE%
) else if exist "scripts\safe-push.sh" (
    echo Running bash safe-push script...
    bash "scripts\safe-push.sh" "%COMMIT_MSG%" "%BRANCH%" "%FORCE%"
) else (
    echo ⚠️  Safe push scripts not found. Using basic git commands...
    echo 📝 Adding changes...
    git add .
    git commit -m "%COMMIT_MSG%"
    echo 🚀 Pushing to %BRANCH%...
    git push origin %BRANCH%
)

endlocal