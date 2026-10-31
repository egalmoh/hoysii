# Legacy Supabase setup (archived)

This guide describes the former Supabase integration. Use [README.md](README.md) for the current Better Auth and Cloudflare Worker setup.

# Somstays Admin Panel - Setup Instructions

## 🔐 Admin Authentication Setup

This admin panel is protected with email-based authentication. Only the authorized admin email can access the dashboard.

### Local Development Setup

1. **Update your admin email** in `.env.local`:
   ```env
   NEXT_PUBLIC_ADMIN_EMAIL=your-actual-email@example.com
   ```

2. **Create an admin user in Supabase**:
   - Go to your Supabase project dashboard
   - Navigate to Authentication > Users
   - Click "Add user"
   - Use the SAME email address you set in `.env.local`
   - Set a strong password
   - Confirm the user's email (or disable email confirmation in Supabase settings)

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Access the admin panel**:
   - Visit `http://localhost:3000`
   - You'll be redirected to `/login`
   - Enter your admin email and password
   - You can now access from anywhere!

### Vercel Deployment Setup

1. **Push your code to GitHub** (already done ✅)

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect it's a Next.js app

3. **Add Environment Variables in Vercel**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://ubijspqriyejmxtjxhft.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     NEXT_PUBLIC_ADMIN_EMAIL=your-actual-email@example.com
     ```
   - Make sure to use your REAL admin email address!

4. **Redeploy** (if needed):
   - Click "Redeploy" in Vercel dashboard

### How It Works

- **Middleware Protection**: The `middleware.js` file intercepts all requests
- **Email Verification**: Checks if the logged-in user's email matches `NEXT_PUBLIC_ADMIN_EMAIL`
- **Automatic Redirect**: Unauthenticated users are sent to `/login`
- **Access from Anywhere**: Once logged in, access from any device, anywhere!

### Security Notes

- ✅ Your admin email is stored as an environment variable
- ✅ Passwords are handled securely by Supabase
- ✅ Only matching email addresses can access the admin panel
- ✅ Works on any device - just login with your credentials
- ⚠️ Keep your `.env.local` file private (it's already in `.gitignore`)
- ⚠️ Use a strong password for your admin account

### Testing the Protection

1. Try accessing the site without logging in → Redirected to login
2. Try logging in with a different email → Access denied
3. Login with your admin email → Full access granted! 🎉
