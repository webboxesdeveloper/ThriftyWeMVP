-- ============================================================================
-- Row Level Security (RLS) Policies for MealDeal
-- Corrected & Security-Reviewed Version
-- ============================================================================

-- ============================================================================
-- USER-SPECIFIC TABLES (Users can only access their own data)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- User Profiles
-- ---------------------------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (signup only)
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ❗ IMPORTANT:
-- No public SELECT policy exists on user_profiles.
-- Email / username availability must be checked via RPC functions
-- (e.g. check_email_exists, check_username_exists).


-- ---------------------------------------------------------------------------
-- User Roles
-- ---------------------------------------------------------------------------
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can ONLY assign themselves the 'user' role
CREATE POLICY "Users can insert own user role"
  ON user_roles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'user'
  );

-- Service role can manage roles (admin assignment)
CREATE POLICY "Service role can manage user roles"
  ON user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites"
  ON favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plans"
  ON plans
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Plan Items
-- ---------------------------------------------------------------------------
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plan items"
  ON plan_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM plans
      WHERE plans.plan_id = plan_items.plan_id
        AND plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM plans
      WHERE plans.plan_id = plan_items.plan_id
        AND plans.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- Plan Item Prices
-- ---------------------------------------------------------------------------
ALTER TABLE plan_item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan item prices"
  ON plan_item_prices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM plan_items pi
      JOIN plans p ON p.plan_id = pi.plan_id
      WHERE pi.plan_item_id = plan_item_prices.plan_item_id
        AND p.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- Plan Totals
-- ---------------------------------------------------------------------------
ALTER TABLE plan_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan totals"
  ON plan_totals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM plans
      WHERE plans.plan_id = plan_totals.plan_id
        AND plans.user_id = auth.uid()
    )
  );


-- ============================================================================
-- PUBLIC READ-ONLY TABLES (Anonymous read access)
-- ============================================================================

-- Dishes
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dishes are publicly readable"
  ON dishes
  FOR SELECT
  TO public
  USING (true);

-- Ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ingredients are publicly readable"
  ON ingredients
  FOR SELECT
  TO public
  USING (true);

-- Dish Ingredients
ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dish ingredients are publicly readable"
  ON dish_ingredients
  FOR SELECT
  TO public
  USING (true);

-- Offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offers are publicly readable"
  ON offers
  FOR SELECT
  TO public
  USING (true);

-- Chains
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chains are publicly readable"
  ON chains
  FOR SELECT
  TO public
  USING (true);

-- Stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stores are publicly readable"
  ON stores
  FOR SELECT
  TO public
  USING (true);

-- Ad Regions
ALTER TABLE ad_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ad regions are publicly readable"
  ON ad_regions
  FOR SELECT
  TO public
  USING (true);

-- Store Region Map
ALTER TABLE store_region_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store region map is publicly readable"
  ON store_region_map
  FOR SELECT
  TO public
  USING (true);

-- Postal Codes
ALTER TABLE postal_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Postal codes are publicly readable"
  ON postal_codes
  FOR SELECT
  TO public
  USING (true);

-- Lookups
ALTER TABLE lookups_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories lookup is publicly readable"
  ON lookups_categories
  FOR SELECT
  TO public
  USING (true);

ALTER TABLE lookups_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Units lookup is publicly readable"
  ON lookups_units
  FOR SELECT
  TO public
  USING (true);

-- Product Map
ALTER TABLE product_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product map is publicly readable"
  ON product_map
  FOR SELECT
  TO public
  USING (true);


-- ---------------------------------------------------------------------------
-- Events (Insert only)
-- ---------------------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own events"
  ON events
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );


-- ============================================================================
-- SERVICE ROLE POLICIES (CSV import via Edge Functions)
-- ============================================================================

-- Ingredients
CREATE POLICY "Service role can insert ingredients"
  ON ingredients
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update ingredients"
  ON ingredients
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Dishes
CREATE POLICY "Service role can insert dishes"
  ON dishes
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update dishes"
  ON dishes
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Dish Ingredients
CREATE POLICY "Service role can insert dish_ingredients"
  ON dish_ingredients
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update dish_ingredients"
  ON dish_ingredients
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Offers
CREATE POLICY "Service role can insert offers"
  ON offers
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update offers"
  ON offers
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Chains
CREATE POLICY "Service role can insert chains"
  ON chains
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update chains"
  ON chains
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ad Regions
CREATE POLICY "Service role can insert ad_regions"
  ON ad_regions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update ad_regions"
  ON ad_regions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Stores
CREATE POLICY "Service role can insert stores"
  ON stores
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update stores"
  ON stores
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Store Region Map
CREATE POLICY "Service role can insert store_region_map"
  ON store_region_map
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update store_region_map"
  ON store_region_map
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Postal Codes
CREATE POLICY "Service role can insert postal_codes"
  ON postal_codes
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update postal_codes"
  ON postal_codes
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Lookups
CREATE POLICY "Service role can insert lookups_categories"
  ON lookups_categories
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update lookups_categories"
  ON lookups_categories
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can insert lookups_units"
  ON lookups_units
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update lookups_units"
  ON lookups_units
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Product Map
CREATE POLICY "Service role can insert product_map"
  ON product_map
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update product_map"
  ON product_map
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Frontend uses anon key → RLS enforced
-- 2. Email / username checks are done via RPC (no public SELECT)
-- 3. Users cannot self-assign admin roles
-- 4. Service role is used only in Edge Functions (CSV import, admin tasks)
