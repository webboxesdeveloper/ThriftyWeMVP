import { supabase } from '@/integrations/supabase/client';

export interface Dish {
  dish_id: string;
  name: string;
  category: string;
  is_quick: boolean;
  is_meal_prep: boolean;
  season?: string;
  cuisine?: string;
  notes?: string;
  totalAggregatedSavings?: number;
  savingsPercent?: number;
  availableOffers?: number;
  ingredientsWithOffers?: number;
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
  region_id: string;
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
  chain_id: string;
  chain_name: string;
}

export interface Store {
  store_id: string;
  chain_id: string;
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
  total_aggregated_savings: number;
  ingredients_with_offers_count: number;
  available_offers_count: number;
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
  qty?: number;
  unit?: string;
  unit_default?: string;
  optional: boolean;
  role?: string;
  price_baseline_per_unit?: number;
  offer_price_per_unit?: number;
  savings_per_unit?: number;
  has_offer: boolean;
  all_offers?: IngredientOffer[];
  offer_source?: string;
  offer_valid_from?: string;
  offer_valid_to?: string;
  offer_pack_size?: number;
  offer_unit_base?: string;
  offer_price_total?: number;
  price_per_unit_baseline?: number;
}

class ApiService {
  async getDishes(filters?: DishFilters, limit = 50): Promise<Dish[]> {
    try {
      let query = supabase
        .from('dishes')
        .select('*')
        .order('name', { ascending: true })
        .limit(limit);

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

      if (filters?.plz) {
        const isValidPLZ = await this.validatePLZ(filters.plz);
        if (!isValidPLZ) {
          throw new Error('Postal code not found. Please enter a valid postal code that exists in our database.');
        }
      }
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

      let chainId: string | null = null;
      if (filters?.chain && filters.chain !== 'all') {
        const chain = await this.getChainByName(filters.chain);
        if (chain) {
          chainId = chain.chain_id;
        }
      }

      const dishesWithSavings = await Promise.all(
        (data || []).map(async (dish) => {
          const pricing = await this.getDishPricing(dish.dish_id, filters?.plz, chainId);
          
          let shouldDisplay = false;
          if (regionId) {
            const { data: displayData, error: displayError } = await supabase.rpc('should_display_dish', {
              _dish_id: dish.dish_id,
              _region_id: regionId,
              _chain_id: chainId,
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
            shouldDisplay,
          };
        })
      );

      let filtered = dishesWithSavings;
      if (filters?.plz && regionId) {
        filtered = dishesWithSavings.filter((d) => d.shouldDisplay);
      } else {
        filtered = [];
      }

      if (filters?.chain && filters.chain !== 'all') {
        const chain = await this.getChainByName(filters.chain);
        if (chain && regionId) {
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
          filtered = [];
        } else {
          filtered = [];
        }
      }

      return filtered.map(({ shouldDisplay, ...dish }) => dish);
    } catch (error: any) {
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
      return null;
    }
  }

  async getDishIngredients(dishId: string, plz?: string | null, chainId?: string | null): Promise<DishIngredient[]> {
    try {
      let regionIds: string[] = [];
      if (plz) {
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', plz);
        if (postalData) {
          regionIds = postalData.map((p) => p.region_id);
        }
      }

      const { data: dishIngredients, error: diError } = await supabase
        .from('dish_ingredients')
        .select('dish_id, ingredient_id, qty, unit, optional, role')
        .eq('dish_id', dishId)
        .order('optional', { ascending: true });

      if (diError) throw diError;
      if (!dishIngredients) return [];

      const ingredientIds = dishIngredients.map((di: any) => di.ingredient_id);
      const { data: ingredientsData, error: ingError } = await supabase
        .from('ingredients')
        .select('ingredient_id, name_canonical, price_baseline_per_unit, unit_default')
        .in('ingredient_id', ingredientIds);

      if (ingError) throw ingError;

      const ingredientsMap = new Map(
        (ingredientsData || []).map((ing: any) => [ing.ingredient_id, ing])
      );

      const today = new Date().toISOString().split('T')[0];

      const allOffersByIngredient = new Map<string, any[]>();
      
      if (regionIds.length > 0 && ingredientIds.length > 0) {
        const { data: offersData } = await supabase
          .from('offers')
          .select('ingredient_id, price_total, pack_size, unit_base, source, valid_from, valid_to, offer_id, source_ref_id, chain_id')
          .in('ingredient_id', ingredientIds)
          .in('region_id', regionIds)
          .lte('valid_from', today)
          .gte('valid_to', today)
          .order('price_total', { ascending: true });

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

      const lowestPriceOfferMap = new Map<string, any>();
      for (const [ingredientId, offers] of allOffersByIngredient.entries()) {
        if (offers.length > 0) {
          if (chainId) {
            const selectedChainOffers = offers.filter((o: any) => o.chain_id === chainId);
            if (selectedChainOffers.length > 0) {
              lowestPriceOfferMap.set(ingredientId, selectedChainOffers[0]);
            } else {
              lowestPriceOfferMap.set(ingredientId, offers[0]);
            }
          } else {
            lowestPriceOfferMap.set(ingredientId, offers[0]);
          }
        }
      }

      return dishIngredients.map((di: any) => {
        const ingredient = ingredientsMap.get(di.ingredient_id);
        const allOffers = allOffersByIngredient.get(di.ingredient_id) || [];
        const lowestPriceOffer = lowestPriceOfferMap.get(di.ingredient_id);
        
        const basePricePerUnit = ingredient?.price_baseline_per_unit ?? undefined;
        let offerPricePerUnit: number | undefined;
        let savingsPerUnit: number | undefined;
        
        if (lowestPriceOffer && lowestPriceOffer.pack_size > 0) {
          offerPricePerUnit = lowestPriceOffer.price_total / lowestPriceOffer.pack_size;
          if (basePricePerUnit !== undefined) {
            savingsPerUnit = basePricePerUnit - offerPricePerUnit;
            if (savingsPerUnit < 0) {
              savingsPerUnit = 0;
            }
          }
        }

        const sortedOffers = [...allOffers].sort((a: any, b: any) => {
          if (chainId) {
            const aIsSelectedChain = a.chain_id === chainId;
            const bIsSelectedChain = b.chain_id === chainId;
            
            if (aIsSelectedChain && !bIsSelectedChain) return -1;
            if (!aIsSelectedChain && bIsSelectedChain) return 1;
            
            const priceDiff = a.price_total - b.price_total;
            if (priceDiff !== 0) return priceDiff;
            
            const chainNameA = (a.chain_name || '').toLowerCase();
            const chainNameB = (b.chain_name || '').toLowerCase();
            const chainDiff = chainNameA.localeCompare(chainNameB);
            if (chainDiff !== 0) return chainDiff;
            
            return a.offer_id - b.offer_id;
          }
          const priceDiff = a.price_total - b.price_total;
          if (priceDiff !== 0) return priceDiff;
          
          const chainNameA = (a.chain_name || '').toLowerCase();
          const chainNameB = (b.chain_name || '').toLowerCase();
          const chainDiff = chainNameA.localeCompare(chainNameB);
          if (chainDiff !== 0) return chainDiff;
          
          return a.offer_id - b.offer_id;
        });

        const calculationOffer = lowestPriceOfferMap.get(di.ingredient_id);
        const processedOffers: IngredientOffer[] = sortedOffers.map((offer: any) => {
          const pricePerUnit = offer.pack_size > 0 ? offer.price_total / offer.pack_size : 0;
          
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
            chain_id: offer.chain_id,
            chain_name: offer.chain_name,
            price_per_unit: pricePerUnit,
            calculated_price_for_qty: undefined,
            is_lowest_price: isBestPrice,
          };
        });

        return {
          dish_id: di.dish_id,
          ingredient_id: di.ingredient_id,
          ingredient_name: ingredient ? ingredient.name_canonical : '',
          qty: di.qty,
          unit: di.unit,
          unit_default: ingredient ? ingredient.unit_default : undefined,
          optional: di.optional || false,
          role: di.role || undefined,
          price_baseline_per_unit: basePricePerUnit,
          offer_price_per_unit: offerPricePerUnit,
          savings_per_unit: savingsPerUnit,
          has_offer: allOffers.length > 0,
          all_offers: processedOffers,
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
      return [];
    }
  }

  private convertUnitForPricing(qty: number, fromUnit: string, toUnit: string): number | null {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    if (from === to) return qty;

    if (from === 'g' && to === 'kg') return qty / 1000.0;
    if (from === 'kg' && to === 'g') return qty * 1000.0;

    if (from === 'ml' && to === 'l') return qty / 1000.0;
    if (from === 'l' && to === 'ml') return qty * 1000.0;

    if ((from === 'stück' || from === 'st') && (to === 'stück' || to === 'st')) {
      return qty;
    }

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
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }

      return data[0];
    } catch (error: any) {
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
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];
      return {
        ingredient_id: result.ingredient_id,
        ingredient_name: '',
        base_price_per_unit: result.base_price_per_unit,
        offer_price_per_unit: result.offer_price_per_unit,
        savings_per_unit: result.savings_per_unit,
        unit: result.unit,
        has_offer: result.has_offer,
      };
    } catch (error: any) {
      return null;
    }
  }

  async dishHasChainOffers(
    dishId: string,
    chainId: string,
    plz?: string | null
  ): Promise<boolean> {
    try {
      let regionIds: string[] = [];
      if (plz) {
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', plz);
        if (postalData) {
          regionIds = postalData.map((p) => p.region_id);
        }
      }

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

      const { data: dishIngredients } = await supabase
        .from('dish_ingredients')
        .select('ingredient_id')
        .eq('dish_id', dishId)
        .eq('optional', false);

      if (!dishIngredients || dishIngredients.length === 0) return false;

      const ingredientIds = dishIngredients.map((di) => di.ingredient_id);
      const today = new Date().toISOString().split('T')[0];

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
      return false;
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('lookups_categories')
        .select('category');

      if (error) throw error;
      return (data || []).map((c) => c.category);
    } catch (error) {
      return [];
    }
  }

  async getChains(plz?: string | null): Promise<Chain[]> {
    try {
      let chainIds: string[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      if (plz) {
        const { data: postalData } = await supabase
          .from('postal_codes')
          .select('region_id')
          .eq('plz', plz);

        if (postalData && postalData.length > 0) {
          const regionIds = postalData.map((p) => p.region_id);

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
        const { data: offersData } = await supabase
          .from('offers')
          .select('chain_id')
          .lte('valid_from', today)
          .gte('valid_to', today);

        if (offersData && offersData.length > 0) {
          chainIds = [...new Set(offersData.map((o) => o.chain_id).filter(Boolean))];
        }
      }

      if (chainIds.length > 0) {
        const { data, error } = await supabase
          .from('chains')
          .select('*')
          .in('chain_id', chainIds)
          .order('chain_name');

        if (error) throw error;
        return data || [];
      }

      return [];
    } catch (error) {
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
      return null;
    }
  }

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await (supabase.rpc as any)('check_email_exists', {
        p_email: email,
      });

      if (error) {
        return false;
      }
      return data === true;
    } catch (error) {
      return false;
    }
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    try {
      const { data, error } = await (supabase.rpc as any)('check_username_exists', {
        p_username: username,
      });

      if (error) {
        return false;
      }
      return data === true;
    } catch (error) {
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
      return false;
    }
  }

  async updateUserPLZ(userId: string, plz: string): Promise<void> {
    try {
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
      throw new Error(error?.message || 'Failed to update location. Please try again.');
    }
  }

  async getFavorites(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('dish_id')
        .eq('user_id', userId);

      if (error) throw error;
      return (data || []).map((f) => f.dish_id);
    } catch (error) {
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
      return false;
    }
  }

  async getTableData(tableName: string, limit = 50, offset = 0): Promise<{ data: any[]; count: number }> {
    try {
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    } catch (error) {
      throw error;
    }
  }

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

      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      const result = {
        validRows: data?.validRows || 0,
        errors: data?.errors || [],
        imported: data?.imported !== undefined ? data.imported : (dryRun ? undefined : 0),
      };

      return result;
    } catch (error: any) {
      throw new Error(error.message || 'CSV import failed');
    }
  }
}

export const api = new ApiService();

