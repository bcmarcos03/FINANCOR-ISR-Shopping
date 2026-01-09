@echo off
cd /d "%~dp0"
SET "ANDROID_HOME=C:\Users\marcos.mata\AppData\Local\Android\Sdk"
SET "JAVA_HOME=C:\Program Files\Java\jdk-17"
SET "GRADLE_HOME=C:\Gradle\gradle-7.6.4"
SET "PATH=%APPDATA%\npm;%GRADLE_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%"

echo.
echo ========================================
echo Building Android APK for Shopping App
echo ========================================
echo.
echo Environment:
echo   ANDROID_HOME: %ANDROID_HOME%
echo   JAVA_HOME: %JAVA_HOME%
echo   GRADLE_HOME: %GRADLE_HOME%
echo.

echo Starting Cordova build...
echo This may take 3-5 minutes on first run...
echo.

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
    echo File size:
    dir platforms\android\app\build\outputs\apk\debug\app-debug.apk | findstr "app-debug.apk"
    echo.
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    echo Check the errors above.
    echo.
)
