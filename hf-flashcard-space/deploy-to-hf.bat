@echo off
echo ========================================
echo Deploying Flashcard Generator to HF
echo ========================================
echo.

REM Check if git is initialized
if not exist .git (
    echo Initializing git repository...
    git init
    echo.
)

REM Add all files
echo Adding files...
git add .
echo.

REM Commit
echo Committing files...
git commit -m "Deploy flashcard generator to Hugging Face Space"
echo.

REM Add HF remote (if not exists)
git remote remove hf 2>nul
echo Adding Hugging Face remote...
git remote add hf https://huggingface.co/spaces/sr0n/flashcard-generator
echo.

REM Push to HF
echo ========================================
echo Ready to push to Hugging Face!
echo.
echo When prompted:
echo   Username: sr0n
echo   Password: [Paste your HF token from Step 2]
echo ========================================
echo.
pause

echo Pushing to Hugging Face Space...
git push hf main

echo.
echo ========================================
echo Deployment complete!
echo.
echo Your Space URL:
echo https://huggingface.co/spaces/sr0n/flashcard-generator
echo.
echo Wait 2-5 minutes for build to complete.
echo ========================================
pause
