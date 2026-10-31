# Legacy Supabase login notes (archived)

These notes describe the former login system. Use [README.md](README.md) for the current Better Auth and Cloudflare Worker setup.

# Debugging Login Issue - Quick Guide

## Current Setup
- ✅ Admin email configured: `lovemoha47@gmail.com`
- ✅ User created in Supabase Auth
- ✅ Admin route: http://localhost:3001/admin

## Steps to Debug

### 1. Open Browser Console
1. Go to http://localhost:3001/admin
2. Press **F12** to open Developer Tools
3. Click on the **Console** tab

### 2. Try to Login
1. Enter email: `lovemoha47@gmail.com`
2. Enter the password you set in Supabase
3. Click "Sign In"

### 3. Check Console Logs
You should see logs like:
```
Login attempt started
Admin email from env: lovemoha47@gmail.com
Supabase response: {data: {...}, error: null}
User email: lovemoha47@gmail.com
Admin email: lovemoha47@gmail.com
Emails match: true
Login successful, redirecting...
```

## Common Issues & Solutions

### Issue 1: "Invalid login credentials"
**Problem**: Wrong email or password
**Solution**:
- Double-check the email matches exactly: `lovemoha47@gmail.com`
- Reset the password in Supabase if needed
- Go to Supabase Dashboard → Authentication → Users → Click on user → Reset password

### Issue 2: "Email not confirmed"
**Problem**: Supabase requires email confirmation
**Solution**:
- Go to Supabase Dashboard → Authentication → Settings
- Disable "Enable email confirmations" OR
- Manually confirm the user: Users → Click on user → Confirm email

### Issue 3: Admin email shows "Not configured"
**Problem**: Environment variable not loading
**Solution**:
- Restart the dev server: Stop (Ctrl+C) and run `npm run dev` again
- Check `.env.local` file has: `NEXT_PUBLIC_ADMIN_EMAIL=lovemoha47@gmail.com`

### Issue 4: "Access denied" message
**Problem**: Email mismatch
**Solution**:
- Check console logs to see what emails are being compared
- Make sure the Supabase user email exactly matches `.env.local`

### Issue 5: Nothing happens, no error
**Problem**: JavaScript error preventing execution
**Solution**:
- Check console for red error messages
- Share the error message for further debugging

## What to Share if Still Not Working

If it's still not working, please share:
1. Any error messages from the browser console (red text)
2. The console logs you see when trying to login
3. Screenshot of the debug info box on the login page
