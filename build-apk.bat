@echo off
SET "ANDROID_HOME=C:\Users\marcos.mata\AppData\Local\Android\Sdk"
SET "JAVA_HOME=C:\Program Files\Java\jdk-17"
SET "GRADLE_HOME=C:\Gradle\gradle-7.6.4"
SET "PATH=%PATH%;%GRADLE_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin"

echo Building Android APK...
echo ANDROID_HOME=%ANDROID_HOME%
echo JAVA_HOME=%JAVA_HOME%
echo GRADLE_HOME=%GRADLE_HOME%
echo.
echo Checking Java version...
"%JAVA_HOME%\bin\java.exe" -version
echo.
echo Checking Gradle version...
gradle --version
echo.

cordova build android

pause
