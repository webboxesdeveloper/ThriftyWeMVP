-- ============================================================================
-- Fix activate_premium_subscription to clear cancelled_at
-- ============================================================================

-- Update the function to clear subscription_cancelled_at when activating new subscription
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
    subscription_cancelled_at = NULL, -- Clear cancelled_at when activating new subscription
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

