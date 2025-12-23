-- ============================================================================
-- MealDeal Database Schema and Backend Logic
-- Consolidated SQL file containing complete current schema
-- This file represents the final state after all 29 migrations
-- Run this file on a fresh database to create the complete schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS lookups_categories (
  category TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS lookups_units (
  unit TEXT PRIMARY KEY,
  description TEXT
);

-- ============================================================================
-- CHAINS AND LOCATIONS
-- ============================================================================

-- Chains (Supermarket chains) - chain_id is TEXT
CREATE TABLE IF NOT EXISTS chains (
  chain_id TEXT PRIMARY KEY,
  chain_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Regions (Advertising regions for offers)
-- Composite primary key: (region_id, chain_id) - allows same region_id across chains
CREATE TABLE IF NOT EXISTS ad_regions (
  region_id TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(chain_id) ON DELETE CASCADE ON UPDATE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (region_id, chain_id)
);

-- Stores - store_id and chain_id are TEXT
CREATE TABLE IF NOT EXISTS stores (
  store_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL REFERENCES chains(chain_id) ON DELETE CASCADE ON UPDATE CASCADE,
  store_name TEXT NOT NULL,
  plz TEXT,
  city TEXT,
  street TEXT,
  lat DECIMAL(10, 8),
  lon DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store-Region Mapping - composite primary key
CREATE TABLE IF NOT EXISTS store_region_map (
  store_id TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  region_id TEXT NOT NULL,
  PRIMARY KEY (store_id, region_id)
);

-- Postal Codes (PLZ) to Region Mapping
CREATE TABLE IF NOT EXISTS postal_codes (
  plz TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PRODUCTS AND DISHES
-- ============================================================================

-- Ingredients - no created_at/updated_at columns
CREATE TABLE IF NOT EXISTS ingredients (
  ingredient_id TEXT PRIMARY KEY,
  name_canonical TEXT NOT NULL,
  unit_default TEXT NOT NULL REFERENCES lookups_units(unit) ON DELETE CASCADE ON UPDATE CASCADE,
  price_baseline_per_unit DECIMAL(10, 2),
  allergen_tags TEXT[],
  notes TEXT
);

-- Dishes
CREATE TABLE IF NOT EXISTS dishes (
  dish_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES lookups_categories(category) ON DELETE CASCADE ON UPDATE CASCADE,
  is_quick BOOLEAN DEFAULT FALSE,
  is_meal_prep BOOLEAN DEFAULT FALSE,
  season TEXT,
  cuisine TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dish-Ingredients (Many-to-Many)
-- qty and unit are optional (nullable) - for reference only, not used in calculations
CREATE TABLE IF NOT EXISTS dish_ingredients (
  dish_id TEXT NOT NULL REFERENCES dishes(dish_id) ON DELETE CASCADE ON UPDATE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE ON UPDATE CASCADE,
  qty DECIMAL(10, 3), -- Optional
  unit TEXT REFERENCES lookups_units(unit) ON DELETE CASCADE ON UPDATE CASCADE, -- Optional
  optional BOOLEAN DEFAULT FALSE,
  role TEXT, -- 'main', 'side', 'Hauptzutat', 'Nebenzutat'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (dish_id, ingredient_id)
);

-- Product Map (Aggregator products to ingredients)
CREATE TABLE IF NOT EXISTS product_map (
  aggregator_product_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE ON UPDATE CASCADE,
  confidence DECIMAL(3, 2) DEFAULT 0.0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OFFERS
-- ============================================================================

-- Offers (Current supermarket offers)
-- region_id is TEXT, chain_id is TEXT (required), offer_id is SERIAL
CREATE TABLE IF NOT EXISTS offers (
  offer_id SERIAL PRIMARY KEY,
  region_id TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(chain_id) ON DELETE CASCADE ON UPDATE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE ON UPDATE CASCADE,
  price_total DECIMAL(10, 2) NOT NULL,
  pack_size DECIMAL(10, 3) NOT NULL DEFAULT 1.0,
  unit_base TEXT NOT NULL REFERENCES lookups_units(unit) ON DELETE CASCADE ON UPDATE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  source TEXT,
  source_ref_id TEXT,
  offer_hash TEXT UNIQUE, -- For deduplication
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite foreign key to ad_regions (region_id, chain_id)
-- Added separately because it references a composite primary key
ALTER TABLE offers
  ADD CONSTRAINT offers_region_id_chain_id_fkey
  FOREIGN KEY (region_id, chain_id)
  REFERENCES ad_regions(region_id, chain_id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ============================================================================
-- USER DATA
-- ============================================================================

-- User Profiles (Anonymous UUID + optional email auth)
-- username has unique constraint (allows multiple NULLs)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  username TEXT, -- Unique if not NULL
  plz TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_username_not_empty CHECK (username IS NULL OR LENGTH(TRIM(username)) > 0)
);

-- Unique index on username (allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_unique 
ON user_profiles(username) 
WHERE username IS NOT NULL;

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  dish_id TEXT NOT NULL REFERENCES dishes(dish_id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, dish_id)
);

-- Meal Plans
CREATE TABLE IF NOT EXISTS plans (
  plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  week_start_date DATE NOT NULL,
  week_iso TEXT,
  status TEXT DEFAULT 'draft',
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan Items
CREATE TABLE IF NOT EXISTS plan_items (
  plan_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE ON UPDATE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  dish_id TEXT NOT NULL REFERENCES dishes(dish_id) ON DELETE CASCADE ON UPDATE CASCADE,
  servings INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan Item Prices
CREATE TABLE IF NOT EXISTS plan_item_prices (
  plan_item_price_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_item_id UUID NOT NULL REFERENCES plan_items(plan_item_id) ON DELETE CASCADE ON UPDATE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE ON UPDATE CASCADE,
  qty DECIMAL(10, 3) NOT NULL,
  unit TEXT NOT NULL REFERENCES lookups_units(unit) ON DELETE CASCADE ON UPDATE CASCADE,
  baseline_price_per_unit DECIMAL(10, 2),
  baseline_total DECIMAL(10, 2),
  offer_price_per_unit DECIMAL(10, 2),
  offer_total DECIMAL(10, 2),
  offer_source TEXT,
  offer_ref_id TEXT,
  savings_abs DECIMAL(10, 2) DEFAULT 0,
  savings_pct DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan Totals
CREATE TABLE IF NOT EXISTS plan_totals (
  plan_id UUID PRIMARY KEY REFERENCES plans(plan_id) ON DELETE CASCADE ON UPDATE CASCADE,
  total_baseline DECIMAL(10, 2) DEFAULT 0,
  total_offer DECIMAL(10, 2) DEFAULT 0,
  total_savings_abs DECIMAL(10, 2) DEFAULT 0,
  total_savings_pct DECIMAL(5, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events/Analytics
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Offers indexes
CREATE INDEX IF NOT EXISTS idx_offers_region ON offers(region_id);
CREATE INDEX IF NOT EXISTS idx_offers_ingredient ON offers(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_offers_valid_dates ON offers(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_offers_hash ON offers(offer_hash);
CREATE INDEX IF NOT EXISTS idx_offers_chain_id ON offers(chain_id);

-- Dish ingredients indexes
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient ON dish_ingredients(ingredient_id);

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_stores_chain ON stores(chain_id);
CREATE INDEX IF NOT EXISTS idx_postal_codes_plz ON postal_codes(plz);
CREATE INDEX IF NOT EXISTS idx_ad_regions_region_id ON ad_regions(region_id);
CREATE INDEX IF NOT EXISTS idx_ad_regions_chain_id ON ad_regions(chain_id);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- ============================================================================
-- FUNCTIONS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_chains_updated_at BEFORE UPDATE ON chains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_regions_updated_at BEFORE UPDATE ON ad_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_map_updated_at BEFORE UPDATE ON product_map
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_totals_updated_at BEFORE UPDATE ON plan_totals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UNIT CONVERSION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_unit(
  qty DECIMAL,
  from_unit TEXT,
  to_unit TEXT
) RETURNS DECIMAL AS $$
BEGIN
  -- If units are the same, return as-is
  IF from_unit = to_unit THEN
    RETURN qty;
  END IF;

  -- Convert weight units (g <-> kg)
  IF from_unit = 'g' AND to_unit = 'kg' THEN
    RETURN qty / 1000.0;
  END IF;
  IF from_unit = 'kg' AND to_unit = 'g' THEN
    RETURN qty * 1000.0;
  END IF;

  -- Convert volume units (ml <-> l)
  IF from_unit = 'ml' AND to_unit = 'l' THEN
    RETURN qty / 1000.0;
  END IF;
  IF from_unit = 'l' AND to_unit = 'ml' THEN
    RETURN qty * 1000.0;
  END IF;

  -- Handle piece units (Stück, st, Stück are the same)
  IF (from_unit IN ('Stück', 'st') AND to_unit IN ('Stück', 'st')) THEN
    RETURN qty;
  END IF;

  -- Handle common unit aliases
  IF from_unit = 'Stück' AND to_unit = 'st' THEN
    RETURN qty;
  END IF;
  IF from_unit = 'st' AND to_unit = 'Stück' THEN
    RETURN qty;
  END IF;

  -- For other units (EL, TL, Bund, etc.), we can't convert automatically
  -- Return qty as-is and let the pricing handle it (might need manual conversion)
  RETURN qty;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PRICING CALCULATION FUNCTIONS
-- ============================================================================

-- DEPRECATED: calculate_dish_price (kept for backwards compatibility)
-- Use calculate_dish_aggregated_savings() instead
CREATE OR REPLACE FUNCTION calculate_dish_price(
  _dish_id TEXT,
  _user_plz TEXT DEFAULT NULL
)
RETURNS TABLE (
  dish_id TEXT,
  base_price DECIMAL(10, 2),
  offer_price DECIMAL(10, 2),
  savings DECIMAL(10, 2),
  savings_percent DECIMAL(5, 2),
  available_offers_count INTEGER
) AS $$
DECLARE
  _region_id TEXT;
  _base_total DECIMAL(10, 2) := 0;
  _offer_total DECIMAL(10, 2) := 0;
  _offers_count INTEGER := 0;
  _ingredient_price DECIMAL(10, 2);
  _offer_price DECIMAL(10, 2);
BEGIN
  -- Get region_id from PLZ if provided
  IF _user_plz IS NOT NULL AND _user_plz != '' THEN
    SELECT region_id INTO _region_id
    FROM postal_codes
    WHERE plz = _user_plz
    LIMIT 1;
  END IF;

  -- Calculate base price: sum of all convertible ingredient prices
  SELECT COALESCE(SUM(
    CASE 
      -- Units match exactly
      WHEN LOWER(TRIM(COALESCE(di.unit, ''))) = LOWER(TRIM(i.unit_default)) THEN
        COALESCE(di.qty, 0) * i.price_baseline_per_unit
      -- Can convert units
      WHEN di.qty IS NOT NULL AND di.unit IS NOT NULL AND convert_unit(di.qty, di.unit, i.unit_default) IS NOT NULL THEN
        convert_unit(di.qty, di.unit, i.unit_default) * i.price_baseline_per_unit
      -- Can't convert - skip (return 0)
      ELSE
        0
    END
  ), 0) INTO _base_total
  FROM dish_ingredients di
  JOIN ingredients i ON di.ingredient_id = i.ingredient_id
  WHERE di.dish_id = _dish_id
    AND di.optional = FALSE
    AND i.price_baseline_per_unit IS NOT NULL
    AND i.price_baseline_per_unit > 0;

  -- Calculate offer price (using current offers if region available)
  IF _region_id IS NOT NULL THEN
    -- Calculate offer price for each ingredient
    FOR _ingredient_price, _offer_price IN
      SELECT 
        -- Baseline price
        CASE 
          WHEN LOWER(TRIM(COALESCE(di.unit, ''))) = LOWER(TRIM(i.unit_default)) THEN
            COALESCE(di.qty, 0) * i.price_baseline_per_unit
          WHEN di.qty IS NOT NULL AND di.unit IS NOT NULL AND convert_unit(di.qty, di.unit, i.unit_default) IS NOT NULL THEN
            convert_unit(di.qty, di.unit, i.unit_default) * i.price_baseline_per_unit
          ELSE
            0
        END,
        -- Offer price (if available)
        CASE 
          WHEN o.offer_id IS NOT NULL THEN
            -- Has offer: calculate offer price
            CASE
              -- Units match offer unit exactly
              WHEN di.qty IS NOT NULL AND di.unit IS NOT NULL AND LOWER(TRIM(di.unit)) = LOWER(TRIM(o.unit_base)) THEN
                -- Calculate: (qty / pack_size) * price_total
                CASE 
                  WHEN o.pack_size > 0 THEN
                    (di.qty / o.pack_size) * o.price_total
                  ELSE
                    COALESCE(di.qty, 0) * i.price_baseline_per_unit
                END
              -- Can convert to offer unit
              WHEN di.qty IS NOT NULL AND di.unit IS NOT NULL AND convert_unit(di.qty, di.unit, o.unit_base) IS NOT NULL THEN
                -- Convert qty to offer unit, then calculate
                CASE 
                  WHEN o.pack_size > 0 THEN
                    (convert_unit(di.qty, di.unit, o.unit_base) / o.pack_size) * o.price_total
                  ELSE
                    convert_unit(di.qty, di.unit, i.unit_default) * i.price_baseline_per_unit
                END
              -- Can't convert to offer unit, use baseline
              ELSE
                CASE 
                  WHEN LOWER(TRIM(COALESCE(di.unit, ''))) = LOWER(TRIM(i.unit_default)) THEN
                    COALESCE(di.qty, 0) * i.price_baseline_per_unit
                  WHEN di.qty IS NOT NULL AND di.unit IS NOT NULL AND convert_unit(di.qty, di.unit, i.unit_default) IS NOT NULL THEN
                    convert_unit(di.qty, di.unit, i.unit_default) * i.price_baseline_per_unit
                  ELSE
                    0
                END
            END
          ELSE
            -- No offer: use baseline price
            CASE 
              WHEN LOWER(TRIM(COALESCE(di.unit, ''))) = LOWER(TRIM(i.unit_default)) THEN
                COALESCE(di.qty, 0) * i.price_baseline_per_unit
              WHEN di.qty IS NOT NULL AND di.unit IS NOT NULL AND convert_unit(di.qty, di.unit, i.unit_default) IS NOT NULL THEN
                convert_unit(di.qty, di.unit, i.unit_default) * i.price_baseline_per_unit
              ELSE
                0
            END
        END
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.ingredient_id
      LEFT JOIN offers o ON 
        o.ingredient_id = di.ingredient_id
        AND o.region_id = _region_id
        AND o.valid_from <= CURRENT_DATE
        AND o.valid_to >= CURRENT_DATE
      WHERE di.dish_id = _dish_id
        AND di.optional = FALSE
        AND i.price_baseline_per_unit IS NOT NULL
        AND i.price_baseline_per_unit > 0
    LOOP
      _offer_total := _offer_total + COALESCE(_offer_price, _ingredient_price, 0);
    END LOOP;

    -- Count available offers
    SELECT COUNT(DISTINCT o.offer_id) INTO _offers_count
    FROM dish_ingredients di
    JOIN offers o ON o.ingredient_id = di.ingredient_id
    WHERE di.dish_id = _dish_id
      AND o.region_id = _region_id
      AND o.valid_from <= CURRENT_DATE
      AND o.valid_to >= CURRENT_DATE
      AND di.optional = FALSE;
  ELSE
    -- No PLZ: use base price
    _offer_total := _base_total;
  END IF;

  -- Return results (ensure no NULL values)
  RETURN QUERY SELECT
    _dish_id::TEXT,
    ROUND(COALESCE(_base_total, 0), 2)::DECIMAL(10, 2),
    ROUND(COALESCE(_offer_total, 0), 2)::DECIMAL(10, 2),
    ROUND(COALESCE(_base_total - _offer_total, 0), 2)::DECIMAL(10, 2),
    CASE WHEN COALESCE(_base_total, 0) > 0 THEN
      ROUND(((COALESCE(_base_total, 0) - COALESCE(_offer_total, 0)) / COALESCE(_base_total, 0) * 100), 2)::DECIMAL(5, 2)
    ELSE 0::DECIMAL(5, 2) END,
    COALESCE(_offers_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Add deprecation comment
COMMENT ON FUNCTION calculate_dish_price(TEXT, TEXT) IS 
  'DEPRECATED: This function calculates total dish prices which is no longer part of the MVP. '
  'Use calculate_dish_aggregated_savings() instead for aggregated per-unit savings. '
  'This function may be removed in a future migration after all code has been updated.';

-- Calculate per-unit savings for an ingredient
CREATE OR REPLACE FUNCTION calculate_ingredient_savings_per_unit(
  _ingredient_id TEXT,
  _region_id TEXT,
  _chain_id TEXT DEFAULT NULL,
  _unit TEXT DEFAULT NULL  -- Optional: if provided, ensures unit matches
)
RETURNS TABLE (
  ingredient_id TEXT,
  base_price_per_unit DECIMAL(10, 4),
  offer_price_per_unit DECIMAL(10, 4),
  savings_per_unit DECIMAL(10, 4),
  unit TEXT,
  has_offer BOOLEAN
) AS $$
DECLARE
  _ingredient_unit TEXT;
  _base_price DECIMAL(10, 4);
  _lowest_offer_price_per_unit DECIMAL(10, 4);
  _today DATE := CURRENT_DATE;
BEGIN
  -- Get ingredient's default unit and base price
  SELECT i.unit_default, i.price_baseline_per_unit
  INTO _ingredient_unit, _base_price
  FROM ingredients i
  WHERE i.ingredient_id = _ingredient_id;

  -- If ingredient not found, return empty
  IF _ingredient_unit IS NULL OR _base_price IS NULL THEN
    RETURN;
  END IF;

  -- If unit parameter provided, check if it matches ingredient's default unit
  IF _unit IS NOT NULL AND _unit != '' THEN
    IF LOWER(TRIM(_unit)) != LOWER(TRIM(_ingredient_unit)) THEN
      IF convert_unit(1.0, _unit, _ingredient_unit) IS NULL THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Get lowest offer price per unit for this ingredient in this region (optionally filtered by chain_id)
  SELECT MIN(o.price_total / NULLIF(o.pack_size, 0))
  INTO _lowest_offer_price_per_unit
  FROM offers o
  WHERE o.ingredient_id = _ingredient_id
    AND o.region_id = _region_id
    AND o.valid_from <= _today
    AND o.valid_to >= _today
    AND (_chain_id IS NULL OR o.chain_id = _chain_id)
    AND o.pack_size > 0;

  -- Return results
  RETURN QUERY SELECT
    _ingredient_id::TEXT,
    COALESCE(_base_price, 0)::DECIMAL(10, 4),
    COALESCE(_lowest_offer_price_per_unit, _base_price)::DECIMAL(10, 4),
    CASE 
      WHEN _lowest_offer_price_per_unit IS NOT NULL AND _lowest_offer_price_per_unit < _base_price THEN
        (_base_price - _lowest_offer_price_per_unit)::DECIMAL(10, 4)
      ELSE
        0::DECIMAL(10, 4)
    END,
    _ingredient_unit::TEXT,
    (_lowest_offer_price_per_unit IS NOT NULL)::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- Calculate aggregated savings for a dish
CREATE OR REPLACE FUNCTION calculate_dish_aggregated_savings(
  _dish_id TEXT,
  _user_plz TEXT DEFAULT NULL,
  _chain_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  dish_id TEXT,
  total_aggregated_savings DECIMAL(10, 2),
  ingredients_with_offers_count INTEGER,
  available_offers_count INTEGER
) AS $$
DECLARE
  _region_id TEXT;
  _total_savings DECIMAL(10, 2) := 0;
  _ingredients_with_offers INTEGER := 0;
  _offers_count INTEGER := 0;
  _ingredient_savings RECORD;
  _today DATE := CURRENT_DATE;
BEGIN
  -- Get region_id from PLZ if provided
  IF _user_plz IS NOT NULL AND _user_plz != '' THEN
    SELECT region_id INTO _region_id
    FROM postal_codes
    WHERE plz = _user_plz
    LIMIT 1;
  END IF;

  -- If no region provided, return zeros
  IF _region_id IS NULL THEN
    RETURN QUERY SELECT
      _dish_id,
      0::DECIMAL(10, 2),
      0,
      0;
    RETURN;
  END IF;

  -- Calculate per-unit savings for each ingredient and aggregate
  -- Includes both main and side ingredients (no optional filter)
  FOR _ingredient_savings IN
    SELECT 
      di.ingredient_id,
      COALESCE(i.price_baseline_per_unit, 0) as baseline_price,
      COALESCE(MIN(o.price_total / NULLIF(o.pack_size, 0)), i.price_baseline_per_unit) as offer_price
    FROM dish_ingredients di
    JOIN ingredients i ON di.ingredient_id = i.ingredient_id
    LEFT JOIN offers o ON 
      o.ingredient_id = di.ingredient_id
      AND o.region_id = _region_id
      AND o.valid_from <= _today
      AND o.valid_to >= _today
      AND (_chain_id IS NULL OR o.chain_id = _chain_id)
      AND o.pack_size > 0
    WHERE di.dish_id = _dish_id
      AND i.price_baseline_per_unit IS NOT NULL
      AND i.price_baseline_per_unit > 0
    GROUP BY di.ingredient_id, i.price_baseline_per_unit
  LOOP
    -- Calculate savings per unit
    IF _ingredient_savings.baseline_price > 0 AND _ingredient_savings.offer_price < _ingredient_savings.baseline_price THEN
      _total_savings := _total_savings + (_ingredient_savings.baseline_price - _ingredient_savings.offer_price);
      _ingredients_with_offers := _ingredients_with_offers + 1;
    END IF;
  END LOOP;

  -- Count total available offers for this dish (optionally filtered by chain_id)
  SELECT COUNT(DISTINCT o.offer_id) INTO _offers_count
  FROM dish_ingredients di
  JOIN offers o ON o.ingredient_id = di.ingredient_id
  WHERE di.dish_id = _dish_id
    AND o.region_id = _region_id
    AND o.valid_from <= _today
    AND o.valid_to >= _today
    AND (_chain_id IS NULL OR o.chain_id = _chain_id);

  -- Return results
  RETURN QUERY SELECT
    _dish_id,
    ROUND(COALESCE(_total_savings, 0), 2)::DECIMAL(10, 2),
    COALESCE(_ingredients_with_offers, 0),
    COALESCE(_offers_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Determine if a dish should be displayed based on offer availability
CREATE OR REPLACE FUNCTION should_display_dish(
  _dish_id TEXT,
  _region_id TEXT,
  _chain_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  _main_ingredients_with_offers INTEGER := 0;
  _secondary_ingredients_with_offers INTEGER := 0;
  _today DATE := CURRENT_DATE;
BEGIN
  -- If no region provided, don't display
  IF _region_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Count main ingredients with active offers (optionally filtered by chain_id)
  SELECT COUNT(DISTINCT di.ingredient_id) INTO _main_ingredients_with_offers
  FROM dish_ingredients di
  JOIN offers o ON o.ingredient_id = di.ingredient_id
  WHERE di.dish_id = _dish_id
    AND o.region_id = _region_id
    AND o.valid_from <= _today
    AND o.valid_to >= _today
    AND (_chain_id IS NULL OR o.chain_id = _chain_id)
    AND (
      LOWER(TRIM(COALESCE(di.role, ''))) = 'main' 
      OR LOWER(TRIM(COALESCE(di.role, ''))) = 'hauptzutat'
    );

  -- If at least 1 main ingredient has an offer, display the dish
  IF _main_ingredients_with_offers >= 1 THEN
    RETURN TRUE;
  END IF;

  -- Count secondary ingredients with active offers (optionally filtered by chain_id)
  SELECT COUNT(DISTINCT di.ingredient_id) INTO _secondary_ingredients_with_offers
  FROM dish_ingredients di
  JOIN offers o ON o.ingredient_id = di.ingredient_id
  WHERE di.dish_id = _dish_id
    AND o.region_id = _region_id
    AND o.valid_from <= _today
    AND o.valid_to >= _today
    AND (_chain_id IS NULL OR o.chain_id = _chain_id)
    AND (
      di.role IS NULL
      OR LOWER(TRIM(di.role)) = 'side'
      OR LOWER(TRIM(di.role)) = 'nebenzutat'
      OR LOWER(TRIM(di.role)) NOT IN ('main', 'hauptzutat')
    );

  -- If at least 2 secondary ingredients have offers, display the dish
  IF _secondary_ingredients_with_offers >= 2 THEN
    RETURN TRUE;
  END IF;

  -- Otherwise, don't display
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- USER PROFILE AND VALIDATION FUNCTIONS
-- ============================================================================

-- Function to create user profile when auth user is created
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
  
  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, username, plz)
  VALUES (NEW.id, NEW.email, v_username, v_plz)
  ON CONFLICT (id) DO UPDATE SET 
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    username = COALESCE(EXCLUDED.username, user_profiles.username),
    plz = COALESCE(EXCLUDED.plz, user_profiles.plz);
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    INSERT INTO public.user_profiles (id, email, plz)
    VALUES (NEW.id, NEW.email, v_plz)
    ON CONFLICT (id) DO UPDATE SET 
      email = COALESCE(EXCLUDED.email, user_profiles.email),
      plz = COALESCE(EXCLUDED.plz, user_profiles.plz);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC function for user profile creation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_username TEXT DEFAULT NULL,
  p_plz TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, username, plz)
  VALUES (p_user_id, p_email, p_username, p_plz)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    username = COALESCE(EXCLUDED.username, user_profiles.username),
    plz = COALESCE(EXCLUDED.plz, user_profiles.plz);
    
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;

-- Function to check if email exists
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles WHERE email = p_email
  );
END;
$$;

-- Function to check if username exists
CREATE OR REPLACE FUNCTION public.check_username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles WHERE username = p_username AND username IS NOT NULL
  );
END;
$$;

-- Grant execute permission to everyone (for signup validation)
GRANT EXECUTE ON FUNCTION public.check_email_exists TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_exists TO anon, authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ingredients IS 'Ingredient master data with baseline prices';
COMMENT ON COLUMN ingredients.ingredient_id IS 'Primary key: Unique ingredient identifier (e.g., I001, I002)';
COMMENT ON COLUMN ingredients.name_canonical IS 'Canonical ingredient name';
COMMENT ON COLUMN ingredients.unit_default IS 'Default unit of measurement (references lookups_units)';
COMMENT ON COLUMN ingredients.price_baseline_per_unit IS 'Baseline price per unit in default unit';
COMMENT ON COLUMN ingredients.allergen_tags IS 'Array of allergen tags (e.g., ["gluten", "dairy"])';
COMMENT ON COLUMN ingredients.notes IS 'Additional notes about the ingredient';

COMMENT ON COLUMN chains.chain_id IS 'Chain identifier in TEXT format (e.g., C001, C002)';
COMMENT ON COLUMN ad_regions.region_id IS 'Region identifier in TEXT format (e.g., R500, R501)';
COMMENT ON COLUMN ad_regions.chain_id IS 'Chain identifier in TEXT format (references chains.chain_id)';
COMMENT ON CONSTRAINT ad_regions_pkey ON ad_regions IS 
'Composite primary key allowing same region_id across different chains. Unique combination of (region_id, chain_id) is required.';

COMMENT ON COLUMN stores.store_id IS 'Store identifier in TEXT format (e.g., S100, S101)';
COMMENT ON COLUMN stores.chain_id IS 'Chain identifier in TEXT format (references chains.chain_id)';
COMMENT ON COLUMN store_region_map.store_id IS 'Store identifier in TEXT format (references stores.store_id)';
COMMENT ON COLUMN store_region_map.region_id IS 'Region identifier in TEXT format (references ad_regions.region_id)';
COMMENT ON COLUMN postal_codes.region_id IS 'Region identifier in TEXT format (references ad_regions.region_id)';
COMMENT ON COLUMN offers.region_id IS 'Region identifier in TEXT format (references ad_regions.region_id)';
COMMENT ON COLUMN offers.chain_id IS 'Chain identifier (references chains.chain_id). Required.';
COMMENT ON COLUMN offers.offer_id IS 'Auto-incrementing primary key (SERIAL)';

COMMENT ON COLUMN dish_ingredients.qty IS 'Optional quantity (for reference only, not used in calculations)';
COMMENT ON COLUMN dish_ingredients.unit IS 'Optional unit (for reference only, not used in calculations). References lookups_units(unit) if provided.';

COMMENT ON INDEX idx_ad_regions_region_id IS 
'Index on region_id for queries filtering by region (non-unique, allows duplicate region_ids across chains).';
COMMENT ON INDEX idx_ad_regions_chain_id IS 
'Index on chain_id for queries filtering by chain. Helps with queries that get all regions for a specific chain.';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

