@echo off
cd /d "%~dp0"
SET "PATH=%APPDATA%\npm;%PATH%"

echo Removing Android platform...
cordova platform remove android

echo Re-adding Android platform...
cordova platform add android@12.0.0

echo Done!
pause
