# Subscription System Setup Guide


## Supabase Setup

### Step 1: Run Database Migrations

1. **Open Supabase Dashboard** → SQL Editor

2. **Run subscription schema migration:**
   ```sql
   -- Run: supabase/migration/030_subscription_schema.sql
   ```
   This creates:
   - Subscription fields in `user_profiles`
   - `subscriptions` table
   - Database functions for subscription management
   - Role validation triggers

3. **Run subscription RLS policies:**
   ```sql
   -- Run: supabase/migration/031_subscription_rls.sql
   ```
   This enables Row Level Security for subscriptions table.

4. **Run fix migration (if needed):**
   ```sql
   -- Run: supabase/migration/032_fix_activate_premium_clear_cancelled.sql
   ```
   This ensures cancelled_at is cleared when activating new subscription.

### Step 3: Deploy Edge Functions

#### Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

#### Login to Supabase
```bash
supabase login
```

#### Link Your Project
```bash
cd supabase
supabase link --project-ref YOUR_PROJECT_REF
```
*(Find project-ref in Settings → API → Project URL, e.g., `https://xxxxx.supabase.co`)*

#### Deploy Stripe Checkout Function
```bash
supabase functions deploy stripe-checkout
```

#### Deploy Stripe Webhook Function
```bash
supabase functions deploy stripe-webhook
```

### Step 4: Configure Edge Function Secrets

Go to **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**

Add these secrets for **both** functions:

#### For `stripe-checkout`:
- `SUPABASE_URL`: Your project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_ANON_KEY`: Found in Settings → API → anon/public key
- `STRIPE_SECRET_KEY`: Your Stripe Secret Key (see Stripe Setup below)
- `FRONTEND_URL`: Your frontend URL (e.g., `http://localhost:8080` for dev, `https://yourdomain.com` for prod)

#### For `stripe-webhook`:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Found in Settings → API → service_role key (⚠️ Keep secret!)
- `STRIPE_SECRET_KEY`: Your Stripe Secret Key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe Webhook Secret (see Stripe Setup below)

**Using CLI:**
```bash
# Set secrets for stripe-checkout
supabase secrets set --project-ref YOUR_PROJECT_REF \
  SUPABASE_URL=https://xxxxx.supabase.co \
  SUPABASE_ANON_KEY=your-anon-key \
  STRIPE_SECRET_KEY=sk_test_... \
  FRONTEND_URL=http://localhost:8080

# Set secrets for stripe-webhook
supabase secrets set --project-ref YOUR_PROJECT_REF \
  SUPABASE_URL=https://xxxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Stripe Setup

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up or log in
3. Complete account setup (verify email, add business details)

### Step 2: Get API Keys

1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
   - **Secret key** (starts with `sk_test_...` or `sk_live_...`)
   - ⚠️ **Keep secret key secure!** Never commit to git.

### Step 3: Configure Webhook Endpoint

#### For Development (Local Testing)

1. **Install Stripe CLI:**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Windows (using Scoop)
   scoop install stripe
   
   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to local Supabase function:**
   ```bash
   # Get your webhook signing secret first (see below)
   stripe listen --forward-to https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```
   
   This will output a webhook signing secret (starts with `whsec_...`). Use this as `STRIPE_WEBHOOK_SECRET`.

#### For Production

1. Go to **Developers** → **Webhooks** → **Add endpoint**

2. **Endpoint URL:**
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```

3. **Events to listen for:**
   - `checkout.session.completed`
   - `payment_intent.succeeded` (optional, for logging)
   - `payment_intent.payment_failed` (optional, for logging)

4. **Copy Webhook Signing Secret:**
   - After creating endpoint, click on it
   - Copy the **Signing secret** (starts with `whsec_...`)
   - Use this as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function secrets

### Step 4: Test Mode vs Live Mode

- **Test Mode**: Use test API keys (`pk_test_...`, `sk_test_...`)
  - Use test card numbers: `4242 4242 4242 4242`
  - CVV: any 3 digits
  - Expiry: any future date
  - ZIP: any 5 digits

- **Live Mode**: Use live API keys (`pk_live_...`, `sk_live_...`)
  - Real payments only
  - Switch in Stripe Dashboard → Toggle "Test mode" off

### Step 5: Configure Products/Prices (Optional)

Currently, the app uses dynamic pricing via `price_data` in the checkout session. If you want to use Stripe Products/Prices:

1. Go to **Products** → **Add product**
2. Create products for each plan (30 days, 90 days, 365 days)
3. Modify `stripe-checkout/index.ts` to use `price` instead of `price_data`

---

## Project Configuration

### Step 1: Frontend Environment Variables

Create `.env.local` in project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe (optional, if using Stripe.js directly)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... (optional)
```

**Note:** Stripe keys are not required in frontend for this implementation, as checkout is handled server-side.

### Step 2: Update Frontend URL in Edge Function

In `supabase/functions/stripe-checkout/index.ts`, ensure `FRONTEND_URL` matches your deployment:

- **Development**: `http://localhost:8080`
- **Production**: `https://yourdomain.com`

This is used for success/cancel redirect URLs.

### Step 3: Verify Pricing Plans

Check `src/pages/PremiumCheckout.tsx` for pricing plans:

```typescript
const PRICING_PLANS = [
  { id: '30days', name: '1 Month', durationDays: 30, price: 9.99 },
  { id: '90days', name: '3 Months', durationDays: 90, price: 24.99, popular: true },
  { id: '365days', name: '1 Year', durationDays: 365, price: 79.99 },
];
```

Update prices as needed.

### Step 2: Test Stripe Checkout (Development)

1. **Start local webhook forwarding:**
   ```bash
   stripe listen --forward-to https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```

2. **Login to your app** as a test user

3. **Navigate to** `/premium/checkout`

4. **Select a plan** and click "Complete Purchase"

5. **Use test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`

6. **Complete payment** → Should redirect to `/premium/status?success=true`

Before going live:

---

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Docs](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0

