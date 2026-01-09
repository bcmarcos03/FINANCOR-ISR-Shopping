@echo off
echo Downloading Gradle 7.6.4 (compatible with Cordova Android 12)...

SET GRADLE_VERSION=7.6.4
SET GRADLE_ZIP=gradle-%GRADLE_VERSION%-bin.zip
SET GRADLE_URL=https://services.gradle.org/distributions/%GRADLE_ZIP%
SET INSTALL_DIR=C:\Gradle

if exist "%INSTALL_DIR%\gradle-%GRADLE_VERSION%" (
    echo Gradle 7.6.4 already installed at %INSTALL_DIR%\gradle-%GRADLE_VERSION%
    goto :end
)

echo Creating install directory...
mkdir "%INSTALL_DIR%" 2>nul

echo Downloading from %GRADLE_URL%...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%GRADLE_URL%' -OutFile '%INSTALL_DIR%\%GRADLE_ZIP%'}"

if not exist "%INSTALL_DIR%\%GRADLE_ZIP%" (
    echo ERROR: Failed to download Gradle
    pause
    exit /b 1
)

echo Extracting Gradle...
powershell -Command "& {Expand-Archive -Path '%INSTALL_DIR%\%GRADLE_ZIP%' -DestinationPath '%INSTALL_DIR%' -Force}"

echo Cleaning up...
del "%INSTALL_DIR%\%GRADLE_ZIP%"

:end
echo.
echo Gradle 7.6.4 installed successfully!
echo Location: %INSTALL_DIR%\gradle-%GRADLE_VERSION%
echo.
echo Now update build-apk.bat to use:
echo SET "GRADLE_HOME=C:\Gradle\gradle-7.6.4"
echo.

pause
