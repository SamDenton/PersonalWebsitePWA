@echo off
set source_dir=%1\wwwroot
set dest_dir=%1
echo Source dir: %source_dir%
echo Dest dir: %dest_dir%
dir "%source_dir%"
xcopy /E /Y "%source_dir%\*" "%dest_dir%"
if errorlevel 1 exit /b 1
rmdir /S /Q "%source_dir%"
if errorlevel 1 exit /b 1
