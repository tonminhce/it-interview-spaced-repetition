@echo off
echo =======================================================
echo Pushing IT Interview Spaced Repetition to GitHub...
echo =======================================================
cd /d "%~dp0"
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Da push thanh cong len GitHub!
    echo Workflow GitHub Pages se tu dong deploy tai:
    echo https://tonminhce.github.io/it-interview-spaced-repetition/
) else (
    echo [CHUYEN Y] Neu gap loi "Repository not found":
    echo Ban hay mo https://github.com/new tren trinh duyet va tao repo ten "it-interview-spaced-repetition", sau do chay lai file nay!
)
pause
