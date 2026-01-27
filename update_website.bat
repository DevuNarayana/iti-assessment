@echo off
setlocal

:: Path to Git executable
set GIT_PATH="C:\Program Files\Git\cmd\git.exe"

echo ------------------------------------------
echo    ITI Assessment - Website Auto-Updater
echo ------------------------------------------

:: Get current status
echo Checking for changes...
%GIT_PATH% status --short

:: Ask for a commit message (optional)
set "msg=Auto Update"
set /p userMsg="Enter a description of your changes (or press Enter for 'Auto Update'): "
if not "%userMsg%"=="" set "msg=%userMsg%"

echo.
echo 1. Adding files...
%GIT_PATH% add .

echo.
echo 2. Saving changes (Commit)...
%GIT_PATH% commit -m "%msg%"

echo.
echo 3. Sending to GitHub (Push)...
%GIT_PATH% push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Website update triggered! 
    echo Vercel will process the changes in ~30 seconds.
) else (
    echo [ERROR] Something went wrong. Check the messages above.
)

echo.
pause
