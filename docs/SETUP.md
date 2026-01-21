# Subscription Setup - Quick Guide

## 1. Supabase Database Setup

### Run Migrations
In Supabase Dashboard → SQL Editor, run in order:

1. `supabase/migration/030_subscription_schema.sql`
2. `supabase/migration/031_subscription_rls.sql`
3. `supabase/migration/032_fix_activate_premium_clear_cancelled.sql`

## 2. Stripe Setup

### Get API Keys
1. Go to [stripe.com](https://stripe.com) → Developers → API keys
2. Copy:
   - **Secret Key** (`sk_test_...` for testing)
   - **Publishable Key** (optional, not needed for this setup)

### Create Webhook Endpoint
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
3. **Events**: Select `checkout.session.completed`
4. **Copy Signing Secret** (`whsec_...`)

## 3. Deploy Edge Functions

```bash
# Install CLI (if needed)
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

## 4. Configure Secrets

Supabase Dashboard → Edge Functions → Settings → Secrets

### For `stripe-checkout`:
- `SUPABASE_URL` = Your Supabase URL
- `SUPABASE_ANON_KEY` = Settings → API → anon key
- `STRIPE_SECRET_KEY` = Your Stripe secret key
- `FRONTEND_URL` = `http://localhost:8080` (dev) or your production URL

### For `stripe-webhook`:
- `SUPABASE_URL` = Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` = Settings → API → service_role key
- `STRIPE_SECRET_KEY` = Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` = Webhook signing secret from step 2

## 5. Frontend Configuration

Create `.env.local`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 6. Test

1. **Start app**: `npm run dev`
2. **Login** as test user
3. **Go to** `/premium/checkout`
4. **Select plan** and checkout
5. **Use test card**: `4242 4242 4242 4242`, any future expiry, any CVC
6. **Verify**: Check `/premium/status` - should show active subscription

## 7. Verify Database

```sql
-- Check subscription activated
SELECT subscription_status, premium_until 
FROM user_profiles 
WHERE id = 'USER_ID'::UUID;

-- Check subscription record
SELECT * FROM subscriptions WHERE user_id = 'USER_ID'::UUID;
```

## Troubleshooting

**Webhook not working?**
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe webhook secret
- Check Edge Function logs in Supabase Dashboard

**Payment succeeds but no premium?**
- Check webhook logs in Stripe Dashboard
- Manually activate: `SELECT activate_premium_subscription('USER_ID'::UUID, 30, 'test', 'card', 9.99);`

**CORS errors?**
- Verify `FRONTEND_URL` in edge function secrets matches your app URL

