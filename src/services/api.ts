// API Service Layer - Wraps Supabase calls
// This provides a clean interface for the UI, abstracting away direct Supabase usage

import { supabase } from '@/integrations/supabase/client';
import { log } from 'console';

// Types
export interface Dish {
  dish_id: string;
  name: string;
  category: string;
  is_quick: boolean;
  is_meal_prep: boolean;
  season?: string;
  cuisine?: string;
  notes?: string;
  // Removed: currentPrice, basePrice (no total price per dish in MVP)
  totalAggregatedSavings?: number; // Sum of per-unit savings from all ingredients with offers
  savingsPercent?: number; // Percentage savings (calculated from aggregated savings)
  availableOffers?: number; // Number of active offers
  ingredientsWithOffers?: number; // Number of ingredients with active offers
  isFavorite?: boolean;
}

export interface Ingredient {
  ingredient_id: string;
  name_canonical: string;
  unit_default: string;
  price_baseline_per_unit?: number;
  allergen_tags?: string[];
  notes?: string;
}

export interface Offer {
  offer_id: number;
  region_id: string;  // Changed from number to string (region_id is now TEXT)
  ingredient_id: string;
  price_total: number;
  pack_size: number;
  unit_base: string;
  valid_from: string;
  valid_to: string;
  source?: string;
  source_ref_id?: string;
}

export interface Chain {
  chain_id: string;  // Changed from number to string (chain_id is now TEXT)
  chain_name: string;
}

export interface Store {
  store_id: string;  // Changed from number to string (store_id is now TEXT)
  chain_id: string;  // Changed from number to string (chain_id is now TEXT)
  store_name: string;
  plz?: string;
  city?: string;
  street?: string;
  lat?: number;
  lon?: number;
}

export interface DishFilters {
  category?: string;
  chain?: string;
  maxPrice?: number;
  plz?: string;
  isQuick?: boolean;
  isMealPrep?: boolean;
}

export interface DishPricing {
  dish_id: string;
  // Removed: base_price, offer_price (no total price per dish)
  total_aggregated_savings: number; // Sum of per-unit savings from all ingredients with offers
  ingredients_with_offers_count: number; // Number of ingredients with active offers
  available_offers_count: number; // Total number of active offers
}

export interface IngredientSavings {
  ingredient_id: string;
  ingredient_name: string;
  base_price_per_unit: number;
  offer_price_per_unit: number;
  savings_per_unit: number;
  unit: string; // kg/liter/piece
  has_offer: boolean;
}

export interface IngredientOffer {
  offer_id: number;
  price_total: number;
  pack_size: number;
  unit_base: string;
  source?: string;
  valid_from?: string;
  valid_to?: string;
  source_ref_id?: string;
  chain_id?: string; // Chain ID for the offer
  chain_name?: string; // Chain name for display
  price_per_unit?: number; // Calculated: price_total / pack_size
  calculated_price_for_qty?: number; // Calculated price for the required qty in this dish
  is_lowest_price: boolean; // Whether this is the best price (selected chain offer or overall lowest)
}

export interface DishIngredient {
  dish_id: string;
  ingredient_id: string;
  ingredient_name: string;
  qty?: number; // Optional - dish_ingredients is for assignment only
  unit?: string; // Optional - dish_ingredients is for assignment only
  unit_default?: string; // Ingredient's default unit (kg/liter/piece)
  optional: boolean;
  role?: string; // 'main', 'side', 'Hauptzutat', 'Nebenzutat', etc.
  // Per-unit pricing (not quantity-based)
  price_baseline_per_unit?: number; // Baseline price per unit
  offer_price_per_unit?: number; // Lowest offer price per unit
  savings_per_unit?: number; // Savings per unit = base_price_per_unit - offer_price_per_unit
  has_offer: boolean;
  // Enhanced offer details - now includes ALL offers
  all_offers?: IngredientOffer[]; // All available offers for this ingredient
  offer_source?: string; // Deprecated - use all_offers[0] if needed (backwards compat)
  offer_valid_from?: string; // Deprecated - use all_offers[0] if needed
  offer_valid_to?: string; // Deprecated - use all_offers[0] if needed
  offer_pack_size?: number; // Deprecated - use all_offers[0] if needed
  offer_unit_base?: string; // Deprecated - use all_offers[0] if needed
  offer_price_total?: number; // Deprecated - use all_offers[0] if needed
  price_per_unit_baseline?: number; // Deprecated - use price_baseline_per_unit
}

// API Service Class
class ApiService {
  // ============ DISHES ============
  async getDishes(filters?: DishFilters, limit = 50): Promise<Dish[]> {
    try {
      let query = supabase
        .from('dishes')
        .select('*')
        .order('name', { ascending: true }) // Order by name to ensure consistent results
        .limit(limit);

      // Apply filters
      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters?.isQuick !== undefined) {
        query = query.eq('is_quick', filters.isQuick);
      }

      if (filters?.isMealPrep !== undefined) {
        query = query.eq('is_meal_prep', filters.isMealPrep);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Validate PLZ if provided
      if (filters?.plz) {
        const isValidPLZ = await this.validatePLZ(filters.plz);
        if (!isValidPLZ) {
          // PLZ is invalid - throw error to inform user
          throw new Error('Postal code not found. Please enter a valid postal code that exists in our database.');
        }
      }

      // Get region_id from PLZ if provided
      let regionId: string | null = null;
      if (filters?.plz) {
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', filters.plz)
          .limit(1);
        if (postalData && postalData.length > 0) {
          regionId = postalData[0].region_id;
        }
      }

      // Get chain_id if chain filter is specified (only if not "all")
      // When "all" is selected, chainId remains null to show all dishes from all chains
      let chainId: string | null = null;
      if (filters?.chain && filters.chain !== 'all') {
        const chain = await this.getChainByName(filters.chain);
        if (chain) {
          chainId = chain.chain_id;
        }
      }

      // Calculate aggregated savings and filter dishes based on display criteria
      // New requirement: Show dish if at least 1 main ingredient OR 2+ secondary ingredients have offers
      // When chainId is null (i.e., "All" selected), functions will return all offers regardless of chain
      const dishesWithSavings = await Promise.all(
        (data || []).map(async (dish) => {
          // Pass chainId (null when "all" is selected, which means no chain filtering)
          const pricing = await this.getDishPricing(dish.dish_id, filters?.plz, chainId);
          
          // Check if dish should be displayed using should_display_dish function
          // When chainId is null, it shows dishes with offers from any chain
          let shouldDisplay = false;
          if (regionId) {
            const { data: displayData, error: displayError } = await supabase.rpc('should_display_dish', {
              _dish_id: dish.dish_id,
              _region_id: regionId,
              _chain_id: chainId, // null when "all" is selected
            });
            if (!displayError && displayData !== null) {
              shouldDisplay = displayData;
            }
          }
          
          return {
            ...dish,
            totalAggregatedSavings: pricing?.total_aggregated_savings ?? 0,
            ingredientsWithOffers: pricing?.ingredients_with_offers_count ?? 0,
            availableOffers: pricing?.available_offers_count ?? 0,
            shouldDisplay, // Flag for filtering
          };
        })
      );

      // Filter dishes based on display criteria
      // - If PLZ provided: use should_display_dish result
      // - If no PLZ: show nothing (empty list) since offers require PLZ
      let filtered = dishesWithSavings;
      if (filters?.plz && regionId) {
        filtered = dishesWithSavings.filter((d) => d.shouldDisplay);
      } else {
        // No PLZ provided - show nothing since we can't determine offers
        filtered = [];
      }

      // Filter by chain if specified (new chain filtering using chain_id from offers table)
      // When "all" is selected (filters.chain === 'all'), no chain filtering is applied
      // This means chainId is null, and database functions return all offers from all chains
      // Only apply additional chain filtering if a specific chain is selected (not "all")
      if (filters?.chain && filters.chain !== 'all') {
        // Get chain_id from chain_name (filters.chain is chain_name)
        const chain = await this.getChainByName(filters.chain);
        if (chain && regionId) {
          // Re-check display criteria with chain_id filter
          // The database function uses chain_id, but we filter by chain_name in the UI
          const dishesWithChainFilter = await Promise.all(
            filtered.map(async (dish) => {
              const { data: displayData, error: displayError } = await supabase.rpc('should_display_dish', {
                _dish_id: dish.dish_id,
                _region_id: regionId,
                _chain_id: chain.chain_id,
              });
              if (!displayError && displayData !== null) {
                return displayData ? dish : null;
              }
              return null;
            })
          );
          
          filtered = dishesWithChainFilter.filter((d) => d !== null) as typeof filtered;
        } else if (chain && !regionId) {
          // No PLZ provided but chain selected - can't filter without region
          filtered = [];
        } else {
          // Chain not found
          filtered = [];
        }
      }
      // When "all" is selected, filtered already contains all dishes from all chains
      // (no additional filtering needed because chainId was null in the previous steps)

      // Remove shouldDisplay flag before returning
      return filtered.map(({ shouldDisplay, ...dish }) => dish);
    } catch (error: any) {
      console.error('Error fetching dishes:', error);
      throw new Error(error?.message || 'Failed to load dishes. Please try again.');
    }
  }

  async getDishById(dishId: string): Promise<Dish | null> {
    try {
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .eq('dish_id', dishId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching dish:', error);
      return null;
    }
  }

  async getDishIngredients(dishId: string, plz?: string | null, chainId?: string | null): Promise<DishIngredient[]> {
    try {
      // Get region_id from PLZ if provided
      let regionIds: string[] = [];  // Changed from number[] to string[] (region_id is now TEXT)
      if (plz) {
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', plz);
        if (postalData) {
          regionIds = postalData.map((p) => p.region_id);
        }
      }

      // Get dish ingredients
      const { data: dishIngredients, error: diError } = await supabase
        .from('dish_ingredients')
        .select('dish_id, ingredient_id, qty, unit, optional, role')
        .eq('dish_id', dishId)
        .order('optional', { ascending: true });

      if (diError) throw diError;
      if (!dishIngredients) return [];

      // Get ingredient details separately
      const ingredientIds = dishIngredients.map((di: any) => di.ingredient_id);
      const { data: ingredientsData, error: ingError } = await supabase
        .from('ingredients')
        .select('ingredient_id, name_canonical, price_baseline_per_unit, unit_default')
        .in('ingredient_id', ingredientIds);

      if (ingError) throw ingError;

      // Create a map of ingredient details
      const ingredientsMap = new Map(
        (ingredientsData || []).map((ing: any) => [ing.ingredient_id, ing])
      );

      const today = new Date().toISOString().split('T')[0];

      // Get ALL current offers for these ingredients if region available
      // Show all chains, but prioritize selected chain offers at the top
      const allOffersByIngredient = new Map<string, any[]>();
      
      if (regionIds.length > 0 && ingredientIds.length > 0) {
        // Fetch ALL offers (no chain filter) so user can see all chain options
        const { data: offersData } = await supabase
          .from('offers')
          .select('ingredient_id, price_total, pack_size, unit_base, source, valid_from, valid_to, offer_id, source_ref_id, chain_id')
          .in('ingredient_id', ingredientIds)
          .in('region_id', regionIds)
          .lte('valid_from', today)
          .gte('valid_to', today)
          .order('price_total', { ascending: true }); // Order by price ascending

        // Get unique chain_ids and fetch chain names
        const uniqueChainIds = offersData ? Array.from(new Set(offersData.map((o: any) => o.chain_id).filter(Boolean))) : [];
        const chainNameMap = new Map<string, string>();
        if (uniqueChainIds.length > 0) {
          const { data: chainsData } = await supabase
            .from('chains')
            .select('chain_id, chain_name')
            .in('chain_id', uniqueChainIds);
          
          if (chainsData) {
            chainsData.forEach((chain: any) => {
              chainNameMap.set(chain.chain_id, chain.chain_name);
            });
          }
        }

        if (offersData) {
          // Group ALL offers by ingredient_id and add chain_name
          for (const offer of offersData) {
            const offerWithChainName = {
              ...offer,
              chain_name: offer.chain_id ? chainNameMap.get(offer.chain_id) || null : null,
            };
            if (!allOffersByIngredient.has(offer.ingredient_id)) {
              allOffersByIngredient.set(offer.ingredient_id, []);
            }
            allOffersByIngredient.get(offer.ingredient_id)!.push(offerWithChainName);
          }
        }
      }

      // Find the lowest price offer from selected chain for each ingredient (for calculation)
      // If no chain selected, use overall lowest price
      const lowestPriceOfferMap = new Map<string, any>();
      for (const [ingredientId, offers] of allOffersByIngredient.entries()) {
        if (offers.length > 0) {
          if (chainId) {
            // Find lowest price offer from selected chain
            const selectedChainOffers = offers.filter((o: any) => o.chain_id === chainId);
            if (selectedChainOffers.length > 0) {
              // Selected chain offers are already sorted by price, so first one is lowest
              lowestPriceOfferMap.set(ingredientId, selectedChainOffers[0]);
            } else {
              // No offers from selected chain, use overall lowest
              lowestPriceOfferMap.set(ingredientId, offers[0]);
            }
          } else {
            // No chain selected, use overall lowest price
            lowestPriceOfferMap.set(ingredientId, offers[0]);
          }
        }
      }

      // Transform to DishIngredient format
      // NEW: Calculate per-unit savings only (not quantity-based prices)
      return dishIngredients.map((di: any) => {
        const ingredient = ingredientsMap.get(di.ingredient_id);
        const allOffers = allOffersByIngredient.get(di.ingredient_id) || [];
        const lowestPriceOffer = lowestPriceOfferMap.get(di.ingredient_id);
        
        // Calculate per-unit prices (not quantity-based)
        const basePricePerUnit = ingredient?.price_baseline_per_unit ?? undefined;
        let offerPricePerUnit: number | undefined;
        let savingsPerUnit: number | undefined;
        
        if (lowestPriceOffer && lowestPriceOffer.pack_size > 0) {
          offerPricePerUnit = lowestPriceOffer.price_total / lowestPriceOffer.pack_size;
          if (basePricePerUnit !== undefined) {
            savingsPerUnit = basePricePerUnit - offerPricePerUnit;
            // Only positive savings (if offer is cheaper than baseline)
            if (savingsPerUnit < 0) {
              savingsPerUnit = 0;
            }
          }
        }

        // Sort offers: selected chain offers first, then by price, then by chain_name and offer_id for stability
        // This ensures selected chain offers appear at the top, and all offers with identical prices are displayed
        const sortedOffers = [...allOffers].sort((a: any, b: any) => {
          if (chainId) {
            const aIsSelectedChain = a.chain_id === chainId;
            const bIsSelectedChain = b.chain_id === chainId;
            
            // Selected chain offers come first
            if (aIsSelectedChain && !bIsSelectedChain) return -1;
            if (!aIsSelectedChain && bIsSelectedChain) return 1;
            
            // Within same group (selected chain or not), sort by price
            const priceDiff = a.price_total - b.price_total;
            if (priceDiff !== 0) return priceDiff;
            
            // If prices are equal, sort by chain_name (for consistent ordering)
            const chainNameA = (a.chain_name || '').toLowerCase();
            const chainNameB = (b.chain_name || '').toLowerCase();
            const chainDiff = chainNameA.localeCompare(chainNameB);
            if (chainDiff !== 0) return chainDiff;
            
            // If chain names are also equal, sort by offer_id (ensures stable sort and all offers shown)
            return a.offer_id - b.offer_id;
          }
          // No chain selected, sort by price, then chain_name, then offer_id
          const priceDiff = a.price_total - b.price_total;
          if (priceDiff !== 0) return priceDiff;
          
          // If prices are equal, sort by chain_name
          const chainNameA = (a.chain_name || '').toLowerCase();
          const chainNameB = (b.chain_name || '').toLowerCase();
          const chainDiff = chainNameA.localeCompare(chainNameB);
          if (chainDiff !== 0) return chainDiff;
          
          // If chain names are also equal, sort by offer_id (ensures stable sort and all offers shown)
          return a.offer_id - b.offer_id;
        });

        // Process ALL offers with per-unit prices
        // Mark selected chain offers as "best price" (for display)
        // Mark the lowest price offer from selected chain (or overall lowest) as used in calculation
        const calculationOffer = lowestPriceOfferMap.get(di.ingredient_id);
        const processedOffers: IngredientOffer[] = sortedOffers.map((offer: any) => {
          // Calculate price per unit
          const pricePerUnit = offer.pack_size > 0 ? offer.price_total / offer.pack_size : 0;
          
          // Mark as "best price" if:
          // 1. It's from the selected chain (when chain is selected), OR
          // 2. It's the overall lowest price offer (when no chain selected)
          const isFromSelectedChain = chainId && offer.chain_id === chainId;
          const isLowestPriceForCalculation = calculationOffer && offer.offer_id === calculationOffer.offer_id;
          const isBestPrice = isFromSelectedChain || (isLowestPriceForCalculation && !chainId);

          return {
            offer_id: offer.offer_id,
            price_total: offer.price_total,
            pack_size: offer.pack_size,
            unit_base: offer.unit_base,
            source: offer.source,
            valid_from: offer.valid_from,
            valid_to: offer.valid_to,
            source_ref_id: offer.source_ref_id,
            chain_id: offer.chain_id, // Include chain_id for display
            chain_name: offer.chain_name, // Include chain_name for display
            price_per_unit: pricePerUnit,
            calculated_price_for_qty: undefined, // No longer used - per-unit only
            is_lowest_price: isBestPrice, // Mark selected chain offers or overall lowest as "best price"
          };
        });

        return {
          dish_id: di.dish_id,
          ingredient_id: di.ingredient_id,
          ingredient_name: ingredient ? ingredient.name_canonical : '',
          qty: di.qty, // Optional - kept for display purposes only
          unit: di.unit, // Optional - kept for display purposes only
          unit_default: ingredient ? ingredient.unit_default : undefined,
          optional: di.optional || false,
          role: di.role || undefined,
          // Per-unit pricing (not quantity-based)
          price_baseline_per_unit: basePricePerUnit,
          offer_price_per_unit: offerPricePerUnit,
          savings_per_unit: savingsPerUnit,
          has_offer: allOffers.length > 0,
          // ALL offers for this ingredient
          all_offers: processedOffers,
          // Deprecated fields (kept for backwards compatibility)
          offer_source: lowestPriceOffer?.source,
          offer_valid_from: lowestPriceOffer?.valid_from,
          offer_valid_to: lowestPriceOffer?.valid_to,
          offer_pack_size: lowestPriceOffer?.pack_size,
          offer_unit_base: lowestPriceOffer?.unit_base,
          offer_price_total: lowestPriceOffer?.price_total,
          price_per_unit_baseline: basePricePerUnit,
        };
      });
    } catch (error: any) {
      console.error('Error fetching dish ingredients:', error);
      return [];
    }
  }

  // Helper to convert units (simplified version matching database logic)
  private convertUnitForPricing(qty: number, fromUnit: string, toUnit: string): number | null {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    if (from === to) return qty;

    // Weight conversions
    if (from === 'g' && to === 'kg') return qty / 1000.0;
    if (from === 'kg' && to === 'g') return qty * 1000.0;

    // Volume conversions
    if (from === 'ml' && to === 'l') return qty / 1000.0;
    if (from === 'l' && to === 'ml') return qty * 1000.0;

    // Piece units
    if ((from === 'stück' || from === 'st') && (to === 'stück' || to === 'st')) {
      return qty;
    }

    // Non-convertible units
    return null;
  }

  async getDishPricing(
    dishId: string,
    plz?: string | null,
    chainId?: string | null
  ): Promise<DishPricing | null> {
    try {
      const { data, error } = await supabase.rpc('calculate_dish_aggregated_savings', {
        _dish_id: dishId,
        _user_plz: plz || null,
        _chain_id: chainId || null,
      });

      if (error) {
        console.error('RPC error calculating dish aggregated savings:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }

      return data[0];
    } catch (error: any) {
      console.error('Error calculating dish aggregated savings:', error);
      // Return null to allow dishes to show with zero savings rather than failing completely
      return null;
    }
  }

  async getIngredientSavings(
    ingredientId: string,
    regionId: string,
    unit?: string | null
  ): Promise<IngredientSavings | null> {
    try {
      const { data, error } = await supabase.rpc('calculate_ingredient_savings_per_unit', {
        _ingredient_id: ingredientId,
        _region_id: regionId,
        _unit: unit || null,
      });

      if (error) {
        console.error('RPC error calculating ingredient savings:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];
      return {
        ingredient_id: result.ingredient_id,
        ingredient_name: '', // Will be filled by caller if needed
        base_price_per_unit: result.base_price_per_unit,
        offer_price_per_unit: result.offer_price_per_unit,
        savings_per_unit: result.savings_per_unit,
        unit: result.unit,
        has_offer: result.has_offer,
      };
    } catch (error: any) {
      console.error('Error calculating ingredient savings:', error);
      return null;
    }
  }

  async dishHasChainOffers(
    dishId: string,
    chainId: string,  // Changed from number to string (chain_id is now TEXT)
    plz?: string | null
  ): Promise<boolean> {
    try {
      // Get region_id from PLZ
      let regionIds: string[] = [];  // Changed from number[] to string[] (region_id is now TEXT)
      if (plz) {
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', plz);
        if (postalData) {
          regionIds = postalData.map((p) => p.region_id);
        }
      }

      // If no PLZ or no regions found, get all regions for this chain
      if (regionIds.length === 0) {
        const { data: regions } = await supabase
          .from('ad_regions')
          .select('region_id')
          .eq('chain_id', chainId);
        if (regions) {
          regionIds = regions.map((r) => r.region_id);
        }     
      }

      if (regionIds.length === 0) return false;

      // Get dish ingredients 
      const { data: dishIngredients } = await supabase
        .from('dish_ingredients')
        .select('ingredient_id')
        .eq('dish_id', dishId)
        .eq('optional', false);

      if (!dishIngredients || dishIngredients.length === 0) return false;

      const ingredientIds = dishIngredients.map((di) => di.ingredient_id);
      const today = new Date().toISOString().split('T')[0];

      // Check if any offers exist for these ingredients in any of the regions
      const { data: offers } = await supabase
        .from('offers')
        .select('offer_id')
        .in('ingredient_id', ingredientIds)
        .in('region_id', regionIds)
        .lte('valid_from', today)
        .gte('valid_to', today)
        .limit(1);

      return offers && offers.length > 0;
    } catch (error) {
      console.error('Error checking chain offers:', error);
      return false;
    }
  }

  // ============ FILTERS ============
  async getCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('lookups_categories')
        .select('category');

      if (error) throw error;
      return (data || []).map((c) => c.category);
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  async getChains(plz?: string | null): Promise<Chain[]> {
    try {
      // Get all chains that have active offers
      // If PLZ is provided, only show chains that have offers in that region
      let chainIds: string[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      if (plz) {
        // Get region_id from PLZ
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', plz);

        if (postalData && postalData.length > 0) {
          const regionIds = postalData.map((p) => p.region_id);

          // Get unique chain_ids from active offers in these regions
          const { data: offersData } = await supabase
            .from('offers')
            .select('chain_id')
            .in('region_id', regionIds)
            .lte('valid_from', today)
            .gte('valid_to', today);

          if (offersData && offersData.length > 0) {
            chainIds = [...new Set(offersData.map((o) => o.chain_id).filter(Boolean))];
          }
        }
      } else {
        // No PLZ provided - get all chains that have active offers
        const { data: offersData } = await supabase
          .from('offers')
          .select('chain_id')
          .lte('valid_from', today)
          .gte('valid_to', today);

        if (offersData && offersData.length > 0) {
          chainIds = [...new Set(offersData.map((o) => o.chain_id).filter(Boolean))];
        }
      }

      // Get chains that match these chain_ids
      if (chainIds.length > 0) {
        const { data, error } = await supabase
          .from('chains')
          .select('*')
          .in('chain_id', chainIds)
          .order('chain_name');

        if (error) throw error;
        return data || [];
      }

      // If no chains found with offers, return empty array
      return [];
    } catch (error) {
      console.error('Error fetching chains:', error);
      return [];
    }
  }

  async getChainByName(chainName: string): Promise<Chain | null> {
    try {
      const { data, error } = await supabase
        .from('chains')
        .select('*')
        .eq('chain_name', chainName)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching chain:', error);
      return null;
    }
  }

  // ============ USER PROFILE ============
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      // Use RPC function to check existence (bypasses RLS, more secure)
      // Type assertion needed because function isn't in generated types yet
      const { data, error } = await (supabase.rpc as any)('check_email_exists', {
        p_email: email,
      });

      if (error) {
        console.error('Error checking email:', error);
        // If RPC doesn't exist, return false and let Supabase handle duplicate email error
        return false;
      }
      return data === true;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    try {
      // Use RPC function to check existence (bypasses RLS, more secure)
      // Type assertion needed because function isn't in generated types yet
      const { data, error } = await (supabase.rpc as any)('check_username_exists', {
        p_username: username,
      });

      if (error) {
        console.error('Error checking username:', error);
        // If RPC doesn't exist, return false and let database constraint handle it
        return false;
      }
      return data === true;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  }

  async getUserPLZ(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plz')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data?.plz || null;
    } catch (error) {
      console.error('Error fetching user PLZ:', error);
      return null;
    }
  }

  async validatePLZ(plz: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('postal_codes')
        .select('plz')
        .eq('plz', plz)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      console.error('Error validating PLZ:', error);
      return false;
    }
  }

  async updateUserPLZ(userId: string, plz: string): Promise<void> {
    try {
      // Validate PLZ exists in database before updating
      const isValid = await this.validatePLZ(plz);
      if (!isValid) {
        throw new Error('Postal code not found. Please enter a valid German postal code that exists in our database.');
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ plz, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating user PLZ:', error);
      throw new Error(error?.message || 'Failed to update location. Please try again.');
    }
  }

  // ============              ============
  async getFavorites(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('dish_id')
        .eq('user_id', userId);

      if (error) throw error;
      return (data || []).map((f) => f.dish_id);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      return [];
    }
  }

  async addFavorite(userId: string, dishId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, dish_id: dishId });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error adding favorite:', error);
      if (error?.code === '23505') {
        throw new Error('This dish is already in your favorites');
      }
      throw new Error(error?.message || 'Failed to add favorite. Please try again.');
    }
  }

  async removeFavorite(userId: string, dishId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('dish_id', dishId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error removing favorite:', error);
      throw new Error(error?.message || 'Failed to remove favorite. Please try again.');
    }
  }

  async isFavorite(userId: string, dishId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('dish_id')
        .eq('user_id', userId)
        .eq('dish_id', dishId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking favorite:', error);
      return false;
    }
  }

  // ============ ADMIN - DATA TABLES ============
  async getTableData(tableName: string, limit = 50, offset = 0): Promise<{ data: any[]; count: number }> {
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Get paginated data
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
      throw error;
    }
  }

  // ============ ADMIN - CSV IMPORT ============
  async importCSV(
    file: File,
    type: string,
    dryRun: boolean = true
  ): Promise<{
    validRows: number;
    errors: string[];
    imported?: number;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('dryRun', dryRun.toString());

      // Use Supabase Edge Function if available, otherwise handle client-side
      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: formData,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      const result = {
        validRows: data?.validRows || 0,
        errors: data?.errors || [],
        imported: data?.imported !== undefined ? data.imported : (dryRun ? undefined : 0),
      };

      return result;
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      throw new Error(error.message || 'CSV import failed');
    }
  }
}

// Export singleton instance
export const api = new ApiService();

