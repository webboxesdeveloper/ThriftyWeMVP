import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api, type Dish, type DishIngredient, type DishPricing } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Heart, 
  Zap, 
  ChefHat, 
  ShoppingCart, 
  Euro,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function DishDetail() {
  const { dishId } = useParams<{ dishId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { userId } = useAuth();
  const [dish, setDish] = useState<Dish | null>(null);
  const [ingredients, setIngredients] = useState<DishIngredient[]>([]);
  const [pricing, setPricing] = useState<DishPricing | null>(null);
  const [userPLZ, setUserPLZ] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedChainName, setSelectedChainName] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);

  useEffect(() => {
    if (dishId && userId) {
      loadUserPLZ();
    }
  }, [dishId, userId]);

  // Load chain information from URL params
  useEffect(() => {
    const chainName = searchParams.get('chain');
    if (chainName && chainName !== 'all') {
      setSelectedChainName(chainName);
      // Get chain_id from chain_name
      api.getChainByName(chainName).then((chain) => {
        if (chain) {
          setSelectedChainId(chain.chain_id);
        }
      });
    } else {
      setSelectedChainName(null);
      setSelectedChainId(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (dishId && userId) {
      loadDishData();
    }
  }, [dishId, userId, userPLZ, selectedChainId]);

  const loadUserPLZ = async () => {
    if (!userId) return;
    try {
      const plz = await api.getUserPLZ(userId);
      if (plz) {
        setUserPLZ(plz);
      }
    } catch (error) {
      console.error('Error loading user PLZ:', error);
    }
  };

  const loadDishData = async () => {
    if (!dishId) return;

    setLoading(true);
    try {
      const [dishData, ingredientsData, pricingData, favorites] = await Promise.all([
        api.getDishById(dishId),
        api.getDishIngredients(dishId, userPLZ || undefined, selectedChainId || undefined),
        api.getDishPricing(dishId, userPLZ || undefined, selectedChainId || undefined),
        userId ? api.getFavorites(userId) : Promise.resolve([]),
      ]);

      if (!dishData) {
        toast.error('Dish not found');
        navigate('/');
        return;
      }

      setDish(dishData);
      setIngredients(ingredientsData);
      setPricing(pricingData);
      setIsFavorite(favorites.includes(dishId));
    } catch (error: any) {
      console.error('Error loading dish data:', error);
      toast.error(error?.message || 'Failed to load dish details');
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    if (!userId || !dishId) return;

    try {
      if (isFavorite) {
        await api.removeFavorite(userId, dishId);
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        await api.addFavorite(userId, dishId);
        setIsFavorite(true);
        toast.success('Added to favorites');
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      toast.error(error?.message || 'Failed to update favorite');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Dish not found</h2>
          <Button onClick={() => navigate(`/${location.search}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dishes
          </Button>
        </div>
      </div>
    );
  }

  const requiredIngredients = ingredients.filter((ing) => !ing.optional);
  const optionalIngredients = ingredients.filter((ing) => ing.optional);

  // Calculate total aggregated savings (sum of per-unit savings)
  const totalAggregatedSavings = pricing?.total_aggregated_savings ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/${location.search}`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">ThriftyWe</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Selected Chain Display */}
        {selectedChainName && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Showing offers from: {selectedChainName}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Savings and prices are calculated based on offers from this chain only.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dish Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <CardTitle className="text-3xl">{dish.name}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleFavorite}
                    className="shrink-0"
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart
                      className={cn(
                        'h-6 w-6',
                        isFavorite && 'fill-destructive text-destructive'
                      )}
                    />
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{dish.category}</Badge>
                  {dish.is_quick && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      <Zap className="h-3 w-3 mr-1" />
                      Quick Meal
                    </Badge>
                  )}
                  {dish.is_meal_prep && (
                    <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
                      <ChefHat className="h-3 w-3 mr-1" />
                      Meal Prep
                    </Badge>
                  )}
                  {dish.cuisine && (
                    <Badge variant="outline">{dish.cuisine}</Badge>
                  )}
                  {dish.season && (
                    <Badge variant="outline">Season: {dish.season}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Aggregated Savings Summary */}
            <div className="space-y-4">
              {totalAggregatedSavings > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white text-lg px-4 py-2">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Total Savings: €{totalAggregatedSavings.toFixed(2)}
                  </Badge>
                  {pricing && pricing.ingredients_with_offers_count > 0 && (
                    <Badge variant="outline" className="text-sm">
                      {pricing.ingredients_with_offers_count} {pricing.ingredients_with_offers_count === 1 ? 'ingredient' : 'ingredients'} on offer
                    </Badge>
                  )}
                </div>
              )}

              {pricing && pricing.available_offers_count > 0 && totalAggregatedSavings === 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {pricing.available_offers_count} {pricing.available_offers_count === 1 ? 'offer' : 'offers'} available
                  </Badge>
                </div>
              )}

              {userPLZ && (
                <p className="text-sm text-muted-foreground">
                  Offers for PLZ {userPLZ}
                </p>
              )}
              {!userPLZ && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/" className="text-primary hover:underline">
                    Enter your postal code
                  </Link>{' '}
                  to see current offers and savings
                </p>
              )}

              {/* Important Notice */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Hinweis:</strong>: Die angezeigten Basispreise sind Einheitspreise (z. B. €/kg, €/l, €/Stück) für reguläre Markenprodukte. Eigenmarken oder Sonderangebote sind nicht berücksichtigt. Tatsächliche Preise können je nach Produkt und Packung variieren.
                </p>
              </div>
            </div>

        
            {dish.notes && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{dish.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ingredients List */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {requiredIngredients.length} main
              {optionalIngredients.length > 0 && `, ${optionalIngredients.length} side`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Main Ingredients */}
              {requiredIngredients.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-lg">Main</h3>
                  <div className="space-y-2">
                    {requiredIngredients.map((ing) => {
                      const hasSavings = ing.savings_per_unit !== undefined && ing.savings_per_unit > 0;
                      
                      return (
                        <div
                          key={ing.ingredient_id}
                          className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors space-y-2"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-base">{ing.ingredient_name}</span>
                                {ing.has_offer && (
                                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                                    On Sale
                                  </Badge>
                                )}
                                {ing.role && (
                                  <Badge variant="outline" className="text-xs">
                                    {ing.role}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {/* Per-unit pricing display (from ingredients table) */}
                              {ing.has_offer && ing.price_baseline_per_unit !== undefined && ing.unit_default && (
                                <div className="space-y-1">
                                  <div className="text-sm text-muted-foreground">
                                    Base: €{ing.price_baseline_per_unit.toFixed(2)}/{ing.unit_default}
                                  </div>
                                  {ing.offer_price_per_unit !== undefined && (
                                    <>
                                      <div className={`font-semibold ${hasSavings ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                                        Offer: €{ing.offer_price_per_unit.toFixed(2)}/{ing.unit_default}
                                      </div>
                                      {hasSavings && ing.savings_per_unit !== undefined && (
                                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                          Save: €{ing.savings_per_unit.toFixed(2)}/{ing.unit_default}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                              {!ing.has_offer && (
                                <span className="text-muted-foreground text-sm">No Offer</span>
                              )}
                              {(!ing.price_baseline_per_unit || !ing.unit_default) && ing.has_offer && (
                                <span className="text-muted-foreground text-sm">N/A</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Enhanced offer details - show ALL available offers */}
                          {ing.has_offer && ing.all_offers && ing.all_offers.length > 0 && (
                            <div className="pt-2 border-t space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                Available Offers ({ing.all_offers.length}):
                              </div>
                              <div className="space-y-2">
                                {ing.all_offers.map((offer, offerIndex) => {
                                  const isLowestPrice = offer.is_lowest_price;
                                  return (
                                    <div
                                      key={offer.offer_id}
                                      className={`p-2.5 rounded-md border text-xs ${
                                        isLowestPrice
                                          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                                          : 'bg-muted/30 border-border'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {/* {isLowestPrice && (
                                              <Badge variant="outline" className="text-xs bg-green-600 text-white border-green-600">
                                                Best Price
                                              </Badge>
                                            )} */}
                                            {offer.chain_name && (
                                              <span className="font-medium text-foreground">
                                                {offer.chain_name}
                                              </span>
                                            )}
                                            {offer.source && (
                                              <span className="text-muted-foreground">
                                                {offer.source}
                                              </span>
                                            )}
                                          </div>
                                          {offer.valid_from && offer.valid_to && (
                                            <div className="text-muted-foreground mt-0.5">
                                              Valid: {new Date(offer.valid_from).toLocaleDateString()} - {new Date(offer.valid_to).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          {offer.price_per_unit !== undefined && (
                                            <div className={`font-semibold ${isLowestPrice ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                                              €{offer.price_per_unit.toFixed(2)}/{offer.unit_base}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                                        {offer.price_per_unit !== undefined && (
                                          <span>
                                            <span className="font-medium">Per {offer.unit_base || ing.unit_default || ing.unit}:</span> €{offer.price_per_unit.toFixed(2)}
                                            {isLowestPrice && ing.price_baseline_per_unit !== undefined && 
                                             offer.price_per_unit < ing.price_baseline_per_unit && (
                                              <span className="line-through ml-1 text-xs">
                                                (was €{ing.price_baseline_per_unit.toFixed(2)}/{ing.unit_default || offer.unit_base})
                                              </span>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* {ing.all_offers.length > 1 && (
                                <div className="text-xs text-muted-foreground italic pt-1">
                                  Note: The lowest price offer (marked "Best Price") is used for savings calculation.
                                </div>
                              )} */}
                            </div>
                          )}
                          
                          {/* Fallback: Show single offer details if all_offers is not available (backwards compatibility) */}
                          {ing.has_offer && (!ing.all_offers || ing.all_offers.length === 0) && (
                            <div className="pt-2 border-t space-y-1.5 text-xs">
                              {ing.offer_source && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <span className="font-medium">Source:</span>
                                  <span>{ing.offer_source}</span>
                                </div>
                              )}
                              {ing.offer_valid_from && ing.offer_valid_to && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <span className="font-medium">Valid:</span>
                                  <span>
                                    {new Date(ing.offer_valid_from).toLocaleDateString()} - {new Date(ing.offer_valid_to).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-4 flex-wrap">
                                {ing.offer_price_per_unit !== undefined && ing.price_baseline_per_unit !== undefined && (
                                  <div className={hasSavings ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                                    <span className="font-medium">Per {ing.offer_unit_base || ing.unit_default || ing.unit}:</span>{' '}
                                    €{ing.offer_price_per_unit.toFixed(2)}
                                    {hasSavings && (
                                      <span className="text-muted-foreground line-through ml-1">
                                        (was €{ing.price_baseline_per_unit.toFixed(2)})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* No additional price info when no offer - already shown as "No Offer" above */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Side Ingredients */}
              {optionalIngredients.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3 text-lg">Side</h3>
                    <div className="space-y-2">
                      {optionalIngredients.map((ing) => {
                        const hasSavings = ing.savings_per_unit !== undefined && ing.savings_per_unit > 0;
                        
                        return (
                        <div
                          key={ing.ingredient_id}
                          className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors space-y-2"
                        >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-base">{ing.ingredient_name}</span>
                                  {ing.has_offer && (
                                    <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                                      On Sale
                                    </Badge>
                                  )}
                                  {ing.role && (
                                    <Badge variant="outline" className="text-xs">
                                      {ing.role}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {/* Per-unit pricing display (from ingredients table) */}
                                {ing.has_offer && ing.price_baseline_per_unit !== undefined && ing.unit_default && (
                                  <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground">
                                      Base: €{ing.price_baseline_per_unit.toFixed(2)}/{ing.unit_default}
                                    </div>
                                    {ing.offer_price_per_unit !== undefined && (
                                      <>
                                        <div className={`font-semibold ${hasSavings ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                                          Offer: €{ing.offer_price_per_unit.toFixed(2)}/{ing.unit_default}
                                        </div>
                                        {hasSavings && ing.savings_per_unit !== undefined && (
                                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            Save: €{ing.savings_per_unit.toFixed(2)}/{ing.unit_default}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                                {!ing.has_offer && (
                                  <span className="text-muted-foreground text-sm">No Offer</span>
                                )}
                                {(!ing.price_baseline_per_unit || !ing.unit_default) && ing.has_offer && (
                                  <span className="text-muted-foreground text-sm">N/A</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Show all offers for optional ingredients too */}
                            {ing.has_offer && ing.all_offers && ing.all_offers.length > 0 && (
                              <div className="pt-2 border-t space-y-2">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">
                                  Available Offers ({ing.all_offers.length}):
                                </div>
                                <div className="space-y-2">
                                  {ing.all_offers.map((offer) => {
                                    const isLowestPrice = offer.is_lowest_price;
                                    return (
                                      <div
                                        key={offer.offer_id}
                                        className={`p-2.5 rounded-md border text-xs ${
                                          isLowestPrice
                                            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                                            : 'bg-muted/30 border-border'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {/* {isLowestPrice && (
                                                <Badge variant="outline" className="text-xs bg-green-600 text-white border-green-600">
                                                  Best Price
                                                </Badge>
                                              )} */}
                                              {offer.source && (
                                                <span className="font-medium text-foreground">
                                                  {offer.source}
                                                </span>
                                              )}
                                            </div>
                                            {offer.valid_from && offer.valid_to && (
                                              <div className="text-muted-foreground mt-0.5">
                                                Valid: {new Date(offer.valid_from).toLocaleDateString()} - {new Date(offer.valid_to).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            {offer.price_per_unit !== undefined && (
                                              <div className={`font-semibold ${isLowestPrice ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                                                €{offer.price_per_unit.toFixed(2)}/{offer.unit_base}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                                          {offer.price_per_unit !== undefined && (
                                            <span>
                                              <span className="font-medium">Per {offer.unit_base || ing.unit_default || ing.unit}:</span> €{offer.price_per_unit.toFixed(2)}
                                              {isLowestPrice && ing.price_baseline_per_unit !== undefined && 
                                               offer.price_per_unit < ing.price_baseline_per_unit && (
                                                <span className="line-through ml-1 text-xs">
                                                  (was €{ing.price_baseline_per_unit.toFixed(2)}/{ing.unit_default || offer.unit_base})
                                                </span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* {ing.all_offers.length > 1 && (
                                  <div className="text-xs text-muted-foreground italic pt-1">
                                    Note: The lowest price offer (marked "Best Price") is used for savings calculation.
                                  </div>
                                )} */}
                              </div>
                            )}  

                            {/* No additional price info when no offer - already shown as "No Offer" above */}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

