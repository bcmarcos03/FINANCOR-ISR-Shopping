@echo off
cd /d "%~dp0"
SET "ANDROID_HOME=C:\Users\marcos.mata\AppData\Local\Android\Sdk"
SET "JAVA_HOME=C:\Program Files\Java\jdk-17"
SET "GRADLE_HOME=C:\Gradle\gradle-7.6.4"
SET "PATH=%APPDATA%\npm;%GRADLE_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%"

echo.
echo ========================================
echo Complete Build Process - Shopping App
echo ========================================
echo.

echo Step 1: Adding Android platform...
cordova platform add android@12.0.0

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to add Android platform
    pause
    exit /b 1
)

echo.
echo Step 2: Building UI5 app...
npm run build:cordova

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: UI5 build failed
    pause
    exit /b 1
)

echo.
echo Step 3: Copying to www...
npx cpy-cli "dist/**" www/

echo.
echo Step 4: Building Android APK...
cordova build android

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo APK Location:
    echo   %cd%\platforms\android\app\build\outputs\apk\debug\app-debug.apk
    echo.
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    echo.
)

pause
