# Supabase Project Setup Guide

## 1. Create Supabase Project

### Step 1: Sign Up / Login
1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"

### Step 2: Project Configuration
- **Name**: Choose a project name (e.g., "ThriftyWeApp")
- **Database Password**: Set a strong password (save it securely)
- **Region**: Choose closest region to your users
- **Pricing Plan**: Select Free tier for development

### Step 3: Wait for Setup
- Wait 2-3 minutes for project provisioning
- Project URL format: `https://[project-ref].supabase.co`

---

## 2. Database Setup

### Step 1: Run Schema Migration
1. Go to **SQL Editor** in Supabase Dashboard
2. Open `supabase/migration/database_schema_and_backend.sql`
3. Copy entire file content
4. Paste into SQL Editor
5. Click **Run** (or press F5)

### Step 2: Run RLS Policies
1. Open `supabase/migration/rls_policies.sql`
2. Copy entire file content
3. Paste into SQL Editor
4. Click **Run**

### Step 3: Verify Tables
Go to **Table Editor** and verify these tables exist:
- `lookups_categories`, `lookups_units`
- `chains`, `ad_regions`, `stores`, `postal_codes`
- `ingredients`, `dishes`, `dish_ingredients`
- `offers`, `store_region_map`
- `user_profiles`, `user_roles`, `favorites`

---

## 3. Authentication Setup

### Step 1: Enable Email/Password Auth
1. Go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. Configure email templates if needed (optional)

### Step 2: Create Admin User
1. Go to **Authentication** → **Users**
2. Click **Add User** → **Create new user**
3. Enter admin email and password
4. **Auto Confirm User**: ✅ (check this)
5. Click **Create User**

### Step 3: Assign Admin Role
1. Go to **SQL Editor**
2. Run this query (replace `admin@example.com` with your admin email):

```sql
-- Get user profile ID
INSERT INTO user_profiles (id, email)
SELECT id, email 
FROM auth.users 
WHERE email = 'admin@example.com'
ON CONFLICT (id) DO NOTHING;

-- Assign admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM user_profiles
WHERE email = 'admin@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## 4. Edge Function Setup

### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```

### Step 3: Link Project
```bash
cd supabase
supabase link --project-ref [your-project-ref]
```
*(Find project-ref in Settings → API → Project URL)*

### Step 4: Deploy Edge Function
```bash
supabase functions deploy import-csv
```

### Step 5: Set Environment Variables
1. Go to **Edge Functions** → **import-csv** → **Settings**
2. Add secrets:
   - `SUPABASE_URL`: Your project URL
   - `SUPABASE_ANON_KEY`: Found in Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY`: Found in Settings → API (⚠️ Keep secret!)

---

## 5. React Frontend Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Environment File
Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=https://[your-project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

**Where to find keys:**
- Go to **Settings** → **API**
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### Step 3: Start Development Server
```bash
npm run dev
```

Frontend runs on `http://localhost:8080`

---

## 6. Verify Connection

### Test Authentication
1. Open `http://localhost:8080`
2. Navigate to login page
3. Log in with admin credentials
4. Should redirect to admin dashboard

### Test Edge Function
1. Go to Admin Dashboard
2. Navigate to CSV Import tab
3. Upload a test CSV file
4. Should process without CORS errors

---

## 7. Quick Reference

### Important URLs
- **Dashboard**: `https://supabase.com/dashboard/project/[project-ref]`
- **API Docs**: `https://[project-ref].supabase.co/rest/v1/`
- **Edge Functions**: Dashboard → Edge Functions

### Key Files
- **Database Schema**: `supabase/migration/database_schema_and_backend.sql`
- **RLS Policies**: `supabase/migration/rls_policies.sql`
- **Edge Function**: `supabase/functions/import-csv/index.ts`
- **Frontend Config**: `src/integrations/supabase/client.ts`

### Common Commands
```bash
# Deploy edge function
supabase functions deploy import-csv

# View function logs
supabase functions logs import-csv

# Reset local database (if using local dev)
supabase db reset
```

---

## Troubleshooting

### CORS Errors
- Ensure edge function is deployed
- Check CORS headers in `index.ts`
- Verify function URL matches project URL

### Authentication Issues
- Verify user exists in `auth.users`
- Check `user_profiles` table has matching record
- Ensure `user_roles` has admin role assigned

### Database Errors
- Verify all migrations ran successfully
- Check RLS policies are active
- Ensure foreign key constraints are satisfied

### Edge Function Errors
- Check function logs in Supabase Dashboard
- Verify environment variables are set
- Ensure service role key has correct permissions

