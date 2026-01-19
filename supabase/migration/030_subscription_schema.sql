-- ============================================================================
-- Subscription & Premium Features Migration
-- Adds subscription management, premium role, and subscription tracking
-- ============================================================================

-- Add subscription fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium', 'cancelled', 'expired')),
ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_duration_days INTEGER DEFAULT 30;

-- Create subscription history table for tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  duration_days INTEGER NOT NULL DEFAULT 30,
  payment_id TEXT, -- External payment reference (e.g., Stripe payment ID)
  payment_method TEXT, -- Payment method used
  amount_paid DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on subscriptions for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

-- Update role constraints to support: free, premium, admin
-- Remove old default and constraint, add new constraint
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Note: PostgreSQL doesn't allow modifying CHECK constraints directly
-- We'll need to recreate the table or use a different approach
-- For now, we'll use a trigger to validate roles

-- Create function to validate role
CREATE OR REPLACE FUNCTION validate_user_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role NOT IN ('free', 'premium', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: %. Valid roles are: free, premium, admin', NEW.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate roles
DROP TRIGGER IF EXISTS check_user_role_valid ON user_roles;
CREATE TRIGGER check_user_role_valid
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_role();

-- Function to check if user has premium access (considering expiration)
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_premium_role BOOLEAN;
  v_premium_until TIMESTAMPTZ;
  v_subscription_status TEXT;
BEGIN
  -- Check if user has premium role
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'premium'
  ) INTO v_has_premium_role;
  
  -- Get subscription info
  SELECT premium_until, subscription_status 
  INTO v_premium_until, v_subscription_status
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- User has premium if:
  -- 1. Has premium role AND
  -- 2. (premium_until is NULL OR premium_until > NOW()) AND
  -- 3. subscription_status is 'premium'
  RETURN v_has_premium_role 
    AND (v_premium_until IS NULL OR v_premium_until > NOW())
    AND (v_subscription_status = 'premium' OR v_subscription_status IS NULL);
END;
$$;

-- Function to activate premium subscription
CREATE OR REPLACE FUNCTION activate_premium_subscription(
  p_user_id UUID,
  p_duration_days INTEGER DEFAULT 30,
  p_payment_id TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_amount_paid DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration date
  v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    subscription_status = 'premium',
    premium_until = v_expires_at,
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_duration_days = p_duration_days,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Add premium role if not exists
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'premium')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove free role if exists (users can only have one subscription role)
  DELETE FROM user_roles 
  WHERE user_id = p_user_id AND role = 'free';
  
  -- Create subscription record
  INSERT INTO subscriptions (
    user_id,
    status,
    started_at,
    expires_at,
    duration_days,
    payment_id,
    payment_method,
    amount_paid
  )
  VALUES (
    p_user_id,
    'active',
    NOW(),
    v_expires_at,
    p_duration_days,
    p_payment_id,
    p_payment_method,
    p_amount_paid
  );
END;
$$;

-- Function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_premium_subscription(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update user profile
  UPDATE user_profiles
  SET 
    subscription_status = 'cancelled',
    subscription_cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Update active subscription record
  UPDATE subscriptions
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND expires_at > NOW();
  
  -- Note: We keep the premium role until expiration
  -- This allows users to use premium until their paid period ends
END;
$$;

-- Function to check and update expired subscriptions (should be run periodically)
CREATE OR REPLACE FUNCTION update_expired_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Update user profiles with expired subscriptions
  WITH expired_users AS (
    UPDATE user_profiles
    SET 
      subscription_status = 'expired',
      updated_at = NOW()
    WHERE subscription_status = 'premium'
      AND premium_until IS NOT NULL
      AND premium_until < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired_users;
  
  -- Remove premium role from expired users
  DELETE FROM user_roles ur
  WHERE ur.role = 'premium'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = ur.user_id
        AND up.subscription_status = 'expired'
    );
  
  -- Add free role to expired users
  INSERT INTO user_roles (user_id, role)
  SELECT id, 'free'
  FROM user_profiles
  WHERE subscription_status = 'expired'
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = user_profiles.id AND role = 'free'
    )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Update subscription records
  UPDATE subscriptions
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at < NOW();
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION has_premium_access TO authenticated, anon;
GRANT EXECUTE ON FUNCTION activate_premium_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_premium_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION update_expired_subscriptions TO authenticated;

-- Update handle_new_user to set 'free' role by default
-- This is already handled, but let's make sure it's explicit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_plz TEXT;
BEGIN
  -- Extract username and PLZ from metadata
  v_username := NEW.raw_user_meta_data->>'username';
  v_plz := NEW.raw_user_meta_data->>'plz';
  
  -- Check if username already exists (if provided)
  IF v_username IS NOT NULL AND LENGTH(TRIM(v_username)) > 0 THEN
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE username = v_username AND id != NEW.id) THEN
      v_username := NULL;
    END IF;
  END IF;
  
  -- Insert user profile with default subscription_status = 'free'
  INSERT INTO public.user_profiles (id, email, username, plz, subscription_status)
  VALUES (NEW.id, NEW.email, v_username, v_plz, 'free')
  ON CONFLICT (id) DO UPDATE SET 
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    username = COALESCE(EXCLUDED.username, user_profiles.username),
    plz = COALESCE(EXCLUDED.plz, user_profiles.plz);
  
  -- Assign default 'free' role (changed from 'user')
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    INSERT INTO public.user_profiles (id, email, plz, subscription_status)
    VALUES (NEW.id, NEW.email, v_plz, 'free')
    ON CONFLICT (id) DO UPDATE SET 
      email = COALESCE(EXCLUDED.email, user_profiles.email),
      plz = COALESCE(EXCLUDED.plz, user_profiles.plz);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

