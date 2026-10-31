# Legacy Supabase deployment guide (archived)

This guide describes the former Supabase integration. Use [README.md](README.md) for the current Cloudflare API setup. Do not restore the exposed service-role key from Git history; rotate it in Supabase.

# Deploying to Vercel - Step by Step Guide

## Step 1: Deploy Your Project

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository: `egalmoh/somstays-web`
4. Click **"Import"**
5. Vercel will auto-detect it's a Next.js app

## Step 2: Add Environment Variables

### Before clicking Deploy:

1. Scroll down to **"Environment Variables"** section
2. Click **"Add"** for each variable below:

### Required Variables:

**Variable 1:**
- **Key**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://ubijspqriyejmxtjxhft.supabase.co`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

**Variable 2:**
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Rotate the exposed legacy Supabase service-role key; do not put it in a client or deployment guide.
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

**Variable 3 (MOST IMPORTANT FOR SECURITY):**
- **Key**: `ADMIN_EMAIL`
- **Value**: `lovemoha47@gmail.com`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

**Variable 4 (Optional - for display):**
- **Key**: `NEXT_PUBLIC_ADMIN_EMAIL`
- **Value**: `lovemoha47@gmail.com`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

### Screenshot Guide:

The Environment Variables section looks like this:

```
┌─────────────────────────────────────────────────┐
│ Environment Variables                           │
├─────────────────────────────────────────────────┤
│ Key                              Value          │
│ ┌────────────────────┐  ┌──────────────────┐  │
│ │ ADMIN_EMAIL        │  │ lovemoha47@...   │  │
│ └────────────────────┘  └──────────────────┘  │
│ Environments: ☑ Production ☑ Preview ☑ Dev    │
│                                                 │
│ [+ Add Another]                                 │
└─────────────────────────────────────────────────┘
```

## Step 3: Deploy

1. After adding all 4 variables, click **"Deploy"**
2. Wait 2-3 minutes for deployment
3. You'll get a URL like: `somstays-admin.vercel.app`

## Step 4: Test Your Deployment

1. Visit your Vercel URL
2. You should be redirected to `/admin`
3. Login with `lovemoha47@gmail.com`
4. You should be able to access the admin panel!

## If You Already Deployed Without Variables:

### Option 1: Add Variables Now

1. Go to your project in Vercel dashboard
2. Click **"Settings"** tab
3. Click **"Environment Variables"** in the sidebar
4. Click **"Add"** and add each variable
5. Click **"Deployments"** tab
6. Click the **"..."** menu on latest deployment
7. Click **"Redeploy"**

### Option 2: Quick Path

1. Dashboard → Your Project → **Settings**
2. Scroll down to **Environment Variables**
3. Add all 4 variables (see above)
4. Go back to **Deployments** → **Redeploy**

## Visual Steps:

```
Vercel Dashboard
    ↓
Your Project
    ↓
Settings (tab at top)
    ↓
Environment Variables (left sidebar)
    ↓
Add (button)
    ↓
Enter Key & Value
    ↓
Select Environments
    ↓
Save
    ↓
Repeat for all 4 variables
    ↓
Deployments (tab at top)
    ↓
Redeploy
```

## Important Notes:

⚠️ **Critical**: Make sure to add `ADMIN_EMAIL` (without NEXT_PUBLIC prefix)! This is what the server uses for security.

✅ **All 4 variables** should be added to Production, Preview, and Development

✅ **After adding variables**, you must redeploy for changes to take effect

✅ **Case sensitive** - Make sure keys match exactly

## Testing After Deployment:

1. Visit your Vercel URL
2. Open browser DevTools (F12) → Console
3. Try to access any page - should redirect to `/admin`
4. Login with your email
5. Should see the admin panel ✅

## Troubleshooting:

**If you can't login:**
- Check Supabase user exists with correct email
- Verify environment variables are set correctly
- Check deployment logs for errors

**To view deployment logs:**
1. Vercel Dashboard → Your Project
2. Click on the deployment
3. Click "View Function Logs"

---

Need help? Check the deployment logs or let me know what error you're seeing!
