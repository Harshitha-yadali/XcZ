@echo off
setlocal

echo ====================================
echo  Deploy Pricing Plan Coupon Backend
echo ====================================
echo.

set PROJECT_REF=rixmudvtbfkjpwjoefon

if "%SUPABASE_ACCESS_TOKEN%"=="" (
    echo ERROR: SUPABASE_ACCESS_TOKEN is not set.
    echo.
    echo Set it in this terminal first, for example:
    echo   set SUPABASE_ACCESS_TOKEN=your_token_here
    echo.
    echo Then run this file again.
    echo.
    pause
    exit /b 1
)

echo Project Ref: %PROJECT_REF%
echo.
echo [1/3] Deploying validate-coupon...
npx supabase functions deploy validate-coupon --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to deploy validate-coupon
    pause
    exit /b 1
)

echo.
echo [2/3] Deploying create-order...
npx supabase functions deploy create-order --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to deploy create-order
    pause
    exit /b 1
)

echo.
echo [3/3] Deploying create-free-subscription...
npx supabase functions deploy create-free-subscription --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to deploy create-free-subscription
    pause
    exit /b 1
)

echo.
echo ====================================
echo  Functions Deployed
echo ====================================
echo.
echo Next required step:
echo 1. Run the SQL in supabase\migrations\20260312160000_add_pricing_plan_coupons.sql
echo    in the Supabase SQL editor, or push that migration with the Supabase CLI.
echo 2. Create the coupon row in Admin ^> Plan Coupons.
echo 3. Retry checkout.
echo.
echo If the coupon still fails, check:
echo https://supabase.com/dashboard/project/%PROJECT_REF%/logs/edge-functions
echo.
pause

