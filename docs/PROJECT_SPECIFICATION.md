# ThrifyWe Project Specification

## Project Overview

ThriftyWe is a web application that helps users discover affordable meals based on real-time supermarket offers. Users enter their postal code (PLZ), and the system calculates dish prices using current ingredient offers from various supermarket chains in their region.

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- React Router (routing)
- TanStack Query (data fetching)
- Tailwind CSS + shadcn/ui (styling)
- Supabase JS Client

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Auth (authentication)
- Supabase Edge Functions (Deno) for CSV import
- Row Level Security (RLS) for data access control

### Project Structure

```
mealdeal-test/
├── src/                          # React frontend source
│   ├── components/              # React components
│   │   ├── admin/              # Admin dashboard components
│   │   └── ui/                 # Reusable UI components
│   ├── pages/                  # Page components
│   │   ├── AdminDashboard.tsx  # Admin CSV import interface
│   │   ├── DishDetail.tsx     # Dish detail page
│   │   └── Index.tsx           # Main dish browsing page
│   ├── hooks/                  # Custom React hooks
│   │   └── useAdminAuth.ts     # Admin authentication check
│   ├── services/               # API service layer
│   │   └── api.ts              # Supabase API wrapper
│   └── integrations/           # Third-party integrations
│       └── supabase/           # Supabase client setup
├── supabase/
│   ├── migrations/             # Database migrations (29 files)
│   ├── functions/              # Edge Functions
│   │   └── import-csv/         # CSV import handler
│   └── seed/                   # Seed data SQL files
├── data/                       # CSV seed data files
└── public/                     # Static assets
```

### Current Deployment Status

**Database:**
- PostgreSQL database hosted on Supabase
- 29 migration files applied
- Row Level Security (RLS) enabled on all tables
- Database functions for pricing calculations

**Backend:**
- Supabase Edge Function `import-csv` deployed
- Service role key configured for admin operations
- Authentication system active

**Frontend:**
- React application (can be deployed to Vercel, Netlify, or any static host)
- Environment variables required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Deployment Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Git

### Step 1: Set Up Supabase Project

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and API keys

2. **Get Your Keys:**
   - Go to Project Settings → API
   - Copy:
     - **Project URL** (e.g., `https://xxxxx.supabase.co`)
     - **anon/public key** (for frontend)
     - **service_role key** (for edge functions - keep secret!)

### Step 2: Run Database Migrations

**Option A: Using Supabase SQL Editor (Recommended for one-time setup)**

1. Open Supabase Dashboard → SQL Editor
2. Run the consolidated schema file: `database_schema_and_backend.sql`
   - This creates all tables, functions, triggers, and indexes
3. Run the RLS policies file: `rls_policies.sql`
   - This sets up Row Level Security policies

**Option B: Using Supabase CLI (For development)**

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Step 3: Configure Edge Function Secrets

The CSV import edge function requires the service role key:

1. **Using Supabase Dashboard:**
   - Go to Project Settings → Edge Functions → Secrets
   - Add secret: `SUPABASE_SERVICE_ROLE_KEY` with your service role key value

2. **Using Supabase CLI:**
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

### Step 4: Deploy Edge Function

1. **Using Supabase CLI:**
   ```bash
   supabase functions deploy import-csv
   ```

2. **Using Supabase Dashboard:**
   - Go to Edge Functions
   - Create new function: `import-csv`
   - Copy contents from `supabase/functions/import-csv/index.ts`
   - Deploy

### Step 5: Set Up React Frontend

1. **Clone/Download Project:**
   ```bash
   git clone <repository-url>
   cd mealdeal-test
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Create Environment File:**
   Create `.env.local` in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```

5. **Build for Production:**
   ```bash
   npm run build
   ```
   Output will be in `dist/` directory

6. **Deploy Frontend:**
   - **Vercel:** Connect GitHub repo, add environment variables, deploy
   - **Netlify:** Drag & drop `dist/` folder or connect repo
   - **Any static host:** Upload `dist/` folder contents

### Step 6: Assign Admin Role

To access the admin dashboard, assign admin role to a user:

1. **Using Supabase SQL Editor:**
   ```sql
   -- Replace 'user-email@example.com' with the admin user's email
   INSERT INTO user_roles (user_id, role)
   SELECT id, 'admin'
   FROM user_profiles
   WHERE email = 'user-email@example.com'
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

2. **Or using user ID:**
   ```sql
   -- Replace 'user-uuid-here' with the user's UUID
   INSERT INTO user_roles (user_id, role)
   VALUES ('user-uuid-here', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

### Step 7: Import Initial Data (Optional)

1. Sign in as admin at `/admin/dashboard`
2. Import CSV files in this order:
   1. Lookup tables (categories, units)
   2. Chains
   3. Ad Regions
   4. Stores
   5. Postal Codes
   6. Store-Region Map
   7. Ingredients
   8. Dishes
   9. Dish-Ingredients
   10. Offers

---

## SQL Migration Files

### File 1: `database_schema_and_backend.sql`

This consolidated file contains the complete current database schema and backend logic:
- All table definitions (lookups, chains, regions, stores, ingredients, dishes, offers, users, etc.)
- All indexes for performance
- All database functions (pricing calculations, unit conversions, validation)
- All triggers (updated_at timestamps, user profile creation)
- All foreign key constraints with CASCADE options
- All current schema modifications (composite keys, TEXT IDs, optional fields, etc.)

**Usage:** Run this single file in Supabase SQL Editor on a fresh database to create the complete schema. This file represents the final state after all 29 migrations.

### File 2: `rls_policies.sql`

This consolidated file contains:
- Row Level Security (RLS) policies for all tables
- Public read access for dishes, ingredients, offers, etc.
- User-specific access for profiles, favorites, plans
- Service role policies for admin operations (CSV import)

**Usage:** Run this file after the schema is created to enable security policies.

---

## Authorization Security for CSV Import

### Current Implementation

**Frontend Authorization:**
- Admin dashboard (`/admin/dashboard`) is protected by `useAdminAuth` hook
- Hook checks `user_roles` table for 'admin' role
- Non-admin users are redirected to login page
- Only authenticated admin users can access the CSV import interface

**Backend Authorization:**
- Edge Function (`import-csv`) uses **service role key** to bypass RLS
- Service role key is stored as environment variable in Supabase
- Edge function has full database access (bypasses all RLS policies)

### Security Model

**Two-Layer Protection:**

1. **Frontend Layer:**
   - React Router protects `/admin/dashboard` route
   - `useAdminAuth` hook verifies admin role before rendering
   - CSV import component only accessible to authenticated admins

2. **Backend Layer:**
   - Edge function uses service role key (bypasses RLS)
   - Service role key is secret and only accessible to Supabase Edge Functions
   - Edge function is deployed server-side (not accessible from client)

### Important Notes

⚠️ **Current Limitation:**
The edge function does **not** verify the user's admin status before processing. It relies on:
- Frontend protection (user must be admin to access the UI)
- Service role key being secret (only accessible server-side)

**Recommendation for Enhanced Security:**
To add server-side admin verification, modify the edge function to:
1. Extract user JWT token from request headers
2. Verify token and get user ID
3. Check `user_roles` table for admin role
4. Only proceed if user is admin

**Current Security Assessment:**
- ✅ Frontend prevents non-admins from accessing import UI
- ✅ Service role key is server-side only (not exposed to client)
- ✅ Edge function is server-side (not accessible directly)
- ⚠️ Edge function does not verify admin status (relies on frontend check)

**For Production:**
The current implementation is acceptable if:
- Frontend is properly secured
- Service role key remains secret
- Edge function URL is not publicly known

For enhanced security, add server-side admin verification as described above.

---

## Maintenance and Updates

### Updating Database Schema

1. Create new migration file in `supabase/migrations/`
2. Run migration in Supabase SQL Editor
3. Test thoroughly before deploying to production

### Updating Edge Functions

1. Modify function code in `supabase/functions/import-csv/index.ts`
2. Deploy using: `supabase functions deploy import-csv`
3. Or update via Supabase Dashboard

### Updating Frontend

1. Make changes to React code
2. Test locally: `npm run dev`
3. Build: `npm run build`
4. Deploy `dist/` folder to hosting service

### Backup and Recovery

- Supabase provides automatic backups (check your plan)
- Export database schema: Use Supabase Dashboard → Database → Export
- Export data: Use CSV export from admin dashboard or SQL queries

---

## Support and Troubleshooting

### Common Issues

**"Postal code not found"**
- Ensure PLZ exists in `postal_codes` table
- Check that PLZ is linked to a valid `region_id`

**"CSV import fails"**
- Check import order (see Step 7)
- Verify foreign key references exist
- Ensure date format is YYYY-MM-DD
- Check for extra commas or missing values

**"Authentication errors"**
- Verify Supabase URL and keys in `.env.local`
- Check RLS policies allow user access
- Ensure user profile exists in `user_profiles` table

**"Admin dashboard not accessible"**
- Verify admin role is assigned (see Step 6)
- Check browser console for errors
- Verify user is signed in

### Getting Help

- Check Supabase documentation: [supabase.com/docs](https://supabase.com/docs)
- Review project README.md for detailed workflows
- Check migration files for schema changes
- Review edge function logs in Supabase Dashboard

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-23  
**Project:** ThriftyWe

