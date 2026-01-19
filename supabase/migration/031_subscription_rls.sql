-- ============================================================================
-- RLS Policies for Subscriptions
-- ============================================================================

-- Subscriptions table: Users can view their own subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can insert their own subscriptions (for payment processing)
CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all subscriptions (for backend processing)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update user_profiles RLS to allow viewing subscription_status
-- (Already covered by existing policies, but ensure subscription fields are accessible)
-- Users can already view their own profile which includes subscription fields

-- Premium content access is checked via the has_premium_access function
-- rather than RLS policies on tables

