import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import { api, type Dish, type DishFilters } from '@/services/api';
import { PLZInput } from '@/components/PLZInput';
import { DishFilters as DishFiltersComponent } from '@/components/DishFilters';
import { DishCard } from '@/components/DishCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { ShoppingCart, Sparkles, LogOut, ArrowUpDown, Heart, User, ChevronDown, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Index() {
  const { userId, loading: authLoading, updatePLZ, signOut, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRestoredRef = useRef(false);
  
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [chains, setChains] = useState<string[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('category') || 'all');
  const [selectedChain, setSelectedChain] = useState(() => searchParams.get('chain') || 'all');
  const [maxPrice, setMaxPrice] = useState(() => parseInt(searchParams.get('maxPrice') || '30', 10));
  const [showQuickMeals, setShowQuickMeals] = useState(() => searchParams.get('quickMeals') === 'true');
  const [showMealPrep, setShowMealPrep] = useState(() => searchParams.get('mealPrep') === 'true');
  const [sortBy, setSortBy] = useState<'savings' | 'name'>(() => (searchParams.get('sortBy') as 'savings' | 'name') || 'savings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc');
  const [loading, setLoading] = useState(true);
  // Use localStorage for PLZ when not authenticated, otherwise use user's PLZ
  const [userPLZ, setUserPLZ] = useState<string>(() => {
    const storedPLZ = localStorage.getItem('guestPLZ');
    return storedPLZ || '30165';
  });
  const [viewMode, setViewMode] = useState<'all' | 'favorites'>(() => {
    const view = searchParams.get('view') as 'all' | 'favorites';
    return view || 'all';
  });
  const [favoriteDishIds, setFavoriteDishIds] = useState<string[]>([]);
  
  const itemsPerPage = 12;
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1', 10));

  const updateURLParams = (updates: {
    category?: string;
    chain?: string;
    maxPrice?: number;
    quickMeals?: boolean;
    mealPrep?: boolean;
    sortBy?: 'savings' | 'name';
    sortDir?: 'asc' | 'desc';
    view?: 'all' | 'favorites';
    page?: number;
  }) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (updates.category !== undefined) {
      if (updates.category === 'all') {
        newParams.delete('category');
      } else {
        newParams.set('category', updates.category);
      }
    }
    
    if (updates.chain !== undefined) {
      if (updates.chain === 'all') {
        newParams.delete('chain');
      } else {
        newParams.set('chain', updates.chain);
      }
    }
    
    if (updates.maxPrice !== undefined) {
      if (updates.maxPrice === 30) {
        newParams.delete('maxPrice');
      } else {
        newParams.set('maxPrice', updates.maxPrice.toString());
      }
    }
    
    if (updates.quickMeals !== undefined) {
      if (!updates.quickMeals) {
        newParams.delete('quickMeals');
      } else {
        newParams.set('quickMeals', 'true');
      }
    }
    
    if (updates.mealPrep !== undefined) {
      if (!updates.mealPrep) {
        newParams.delete('mealPrep');
      } else {
        newParams.set('mealPrep', 'true');
      }
    }
    
    if (updates.sortBy !== undefined) {
      if (updates.sortBy === 'savings') {
        newParams.delete('sortBy');
      } else {
        newParams.set('sortBy', updates.sortBy);
      }
    }
    
    if (updates.sortDir !== undefined) {
      if (updates.sortDir === 'desc') {
        newParams.delete('sortDir');
      } else {
        newParams.set('sortDir', updates.sortDir);
      }
    }
    
    if (updates.view !== undefined) {
      if (updates.view === 'all') {
        newParams.delete('view');
      } else {
        newParams.set('view', updates.view);
      }
    }
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        newParams.delete('page');
      } else {
        newParams.set('page', updates.page.toString());
      }
    }
    
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    if (userId) {
      loadUserData();
    }
  }, [userId]);

  // Load filter options whenever PLZ changes (works with or without auth)
  useEffect(() => {
    loadFilterOptions();
  }, [userPLZ]);

  // Load favorites only when logged in
  useEffect(() => {
    if (userId) {
      loadFavorites();
    } else {
      setFavoriteDishIds([]);
      // Reset to 'all' view if not logged in and viewing favorites
      if (viewMode === 'favorites') {
        setViewMode('all');
        updateURLParams({ view: 'all' });
      }
    }
  }, [userId]);

  // Sync currentPage with URL params (important when returning from detail page)
  useEffect(() => {
    const pageFromURL = parseInt(searchParams.get('page') || '1', 10);
    if (pageFromURL !== currentPage) {
      setCurrentPage(pageFromURL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Load dishes whenever filters change (works with or without auth)
  useEffect(() => {
    loadDishes();
  }, [selectedCategory, selectedChain, maxPrice, userPLZ, showQuickMeals, showMealPrep, viewMode, userId]);

  // Restore scroll position when returning from dish detail
  useEffect(() => {
    // Only restore if we have a saved scroll position and data is loaded
    if (!loading && dishes.length > 0) {
      const savedScrollPosition = sessionStorage.getItem('scrollPosition');
      if (savedScrollPosition && !scrollRestoredRef.current) {
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
          window.scrollTo({
            top: parseInt(savedScrollPosition, 10),
            behavior: 'auto' // Instant scroll, not smooth
          });
          sessionStorage.removeItem('scrollPosition');
          scrollRestoredRef.current = true;
        });
      }
    }
  }, [loading, dishes.length]);

  // Save scroll position while scrolling (for when user navigates away)
  useEffect(() => {
    const handleScroll = () => {
      if (location.pathname === '/') {
        sessionStorage.setItem('scrollPosition', window.scrollY.toString());
      }
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [location.pathname]);

  const loadUserData = async () => {
    if (!userId) return;

    try {
      const plz = await api.getUserPLZ(userId);
      if (plz) {
        setUserPLZ(plz);
      }
    } catch (error) {
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [categoriesData, chainsData] = await Promise.all([
        api.getCategories(),
        api.getChains(userPLZ || undefined), // Pass PLZ to filter chains by region
      ]);

      setCategories(categoriesData);
      setChains(chainsData.map((c) => c.chain_name));
      
      if (selectedChain !== 'all' && chainsData.length > 0) {
        const chainNames = chainsData.map((c) => c.chain_name);
        if (!chainNames.includes(selectedChain)) {
          setSelectedChain('all');
        }
      }
    } catch (error) {
    }
  };

  const loadFavorites = async () => {
    if (!userId) return;
    try {
      const favorites = await api.getFavorites(userId);
      setFavoriteDishIds(favorites);
    } catch (error) {
    }
  };

  const loadDishes = async () => {
    // Don't load favorites view if not logged in
    if (viewMode === 'favorites' && !userId) {
      setViewMode('all');
      updateURLParams({ view: 'all' });
      return;
    }

    setLoading(true);
    try {
      const filters: DishFilters = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        chain: selectedChain !== 'all' ? selectedChain : undefined,
        maxPrice,
        plz: userPLZ || undefined,
        isQuick: showQuickMeals ? true : undefined,
        isMealPrep: showMealPrep ? true : undefined,
      };

      let dishesData = await api.getDishes(filters, 10000); 

      // Only load favorites if logged in
      let favorites: string[] = [];
      if (userId) {
        favorites = await api.getFavorites(userId);
        setFavoriteDishIds(favorites);
      } else {
        setFavoriteDishIds([]);
      }

      if (viewMode === 'favorites' && userId) {
        dishesData = dishesData.filter((dish) => favorites.includes(dish.dish_id));
      }

      const dishesWithFavorites: Dish[] = dishesData.map((dish) => ({
        ...dish,
        isFavorite: userId ? favorites.includes(dish.dish_id) : false,
      }));

      const sortedDishes = sortDishes(dishesWithFavorites, sortBy, sortDirection);

      setDishes(sortedDishes);
      
      if (currentPage > 1) {
        const totalPages = Math.ceil(sortedDishes.length / itemsPerPage);
        if (currentPage > totalPages) {
          setCurrentPage(1);
          updateURLParams({ page: 1 });
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load dishes. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

      const sortDishes = (dishes: Dish[], sort: typeof sortBy, direction: 'asc' | 'desc'): Dish[] => {
    const sorted = [...dishes];
    switch (sort) {
      case 'savings':
        if (direction === 'desc') {
          return sorted.sort((a, b) => (b.totalAggregatedSavings || 0) - (a.totalAggregatedSavings || 0));
        } else {
          return sorted.sort((a, b) => (a.totalAggregatedSavings || 0) - (b.totalAggregatedSavings || 0));
        }
      case 'name':
        if (direction === 'asc') {
          return sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          return sorted.sort((a, b) => b.name.localeCompare(a.name));
        }
      default:
        return sorted;
    }
  };

  const handleSortChange = (value: typeof sortBy) => {
    const newDirection = value === 'savings' ? 'desc' : 'asc';
    setSortBy(value);
    setSortDirection(newDirection);
    updateURLParams({ sortBy: value, sortDir: newDirection });
    setDishes((currentDishes) => sortDishes([...currentDishes], value, newDirection));
  };

  const handleSortDirectionToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    updateURLParams({ sortDir: newDirection });
    setDishes((currentDishes) => sortDishes([...currentDishes], sortBy, newDirection));
  };

  const handlePLZChange = async (plz: string) => {
    const isValid = await api.validatePLZ(plz);
    if (!isValid) {
      throw new Error('Postal code not found. Please enter a valid postal code that exists in our database.');
    }

    try {
      if (userId) {
        // If logged in, save to user profile
        await api.updateUserPLZ(userId, plz);
        await updatePLZ(plz);
      } else {
        // If not logged in, save to localStorage
        localStorage.setItem('guestPLZ', plz);
      }
      setUserPLZ(plz);
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to update location. Please check your postal code and try again.');
    }
  };

  const handleFavorite = async (dishId: string) => {
    if (!userId) return;

    try {
      const isFavorite = await api.isFavorite(userId, dishId);
      if (isFavorite) {
        await api.removeFavorite(userId, dishId);
        toast.success('Removed from favorites');
      } else {
        await api.addFavorite(userId, dishId);
        toast.success('Added to favorites');
      }
      
      await loadFavorites();
      
      setDishes((prevDishes) =>
        prevDishes.map((dish) =>
          dish.dish_id === dishId
            ? { ...dish, isFavorite: !isFavorite }
            : dish
        )
      );
      
      setFavoriteDishIds((prev) => {
        if (isFavorite) {
          return prev.filter((id) => id !== dishId);
        } else {
          return [...prev, dishId];
        }
      });
      
      loadDishes().catch((error) => {
      });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update favorite. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign out');
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    updateURLParams({ category, page: 1 });
  };

  const handleChainChange = (chain: string) => {
    setSelectedChain(chain);
    setCurrentPage(1);
    updateURLParams({ chain, page: 1 });
  };

  const handleMaxPriceChange = (price: number) => {
    setMaxPrice(price);
    setCurrentPage(1);
    updateURLParams({ maxPrice: price, page: 1 });
  };

  const handleQuickMealsChange = (show: boolean) => {
    setShowQuickMeals(show);
    setCurrentPage(1);
    updateURLParams({ quickMeals: show, page: 1 });
  };

  const handleMealPrepChange = (show: boolean) => {
    setShowMealPrep(show);
    setCurrentPage(1);
    updateURLParams({ mealPrep: show, page: 1 });
  };

  const handleViewModeChange = (mode: 'all' | 'favorites') => {
    setViewMode(mode);
    setCurrentPage(1);
    updateURLParams({ view: mode, page: 1 });
  };

  const totalPages = Math.ceil(dishes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDishes = dishes.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateURLParams({ page });
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Clear saved scroll position since we're changing pages
    sessionStorage.removeItem('scrollPosition');
  };

  // Reusable pagination component
  const renderPagination = () => {
    if (dishes.length === 0 || totalPages <= 1) return null;

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) handlePageChange(currentPage - 1);
              }}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              href="#"
            />
          </PaginationItem>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(page);
                    }}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                    href="#"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            } else if (page === currentPage - 2 || page === currentPage + 2) {
              return (
                <PaginationItem key={page}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }
            return null;
          })}
          
          <PaginationItem>
            <PaginationNext
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) handlePageChange(currentPage + 1);
              }}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              href="#"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // Only show loading for dish loading, not auth loading (so page loads immediately)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">ThriftyWe</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {userId ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {userProfile?.username 
                            ? userProfile.username.charAt(0).toUpperCase()
                            : userProfile?.email 
                            ? userProfile.email.charAt(0).toUpperCase()
                            : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden md:flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {userProfile?.username || userProfile?.email || 'User'}
                        </span>
                        {userProfile?.username && userProfile?.email && (
                          <span className="text-xs text-muted-foreground">{userProfile.email}</span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 hidden md:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {userProfile?.username || 'User'}
                        </p>
                        {userProfile?.email && (
                          <p className="text-xs leading-none text-muted-foreground">
                            {userProfile.email}
                          </p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden md:inline">Login</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h2 className="text-3xl md:text-4xl font-bold">Cook Smart, Save More</h2>
            </div>
            <p className="text-lg text-muted-foreground">
              Discover delicious meals based on current supermarket deals in your area
            </p>
            <div className="max-w-md mx-auto">
              <PLZInput onPLZChange={handlePLZChange} currentPLZ={userPLZ} />
            </div>
            {userPLZ && <p className="text-sm text-muted-foreground">Showing deals for PLZ {userPLZ}</p>}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <DishFiltersComponent
                categories={categories}
                chains={chains}
                selectedCategory={selectedCategory}
                selectedChain={selectedChain}
                maxPrice={maxPrice}
                showQuickMeals={showQuickMeals}
                showMealPrep={showMealPrep}
                onCategoryChange={handleCategoryChange}
                onChainChange={handleChainChange}
                onMaxPriceChange={handleMaxPriceChange}
                onQuickMealsChange={handleQuickMealsChange}
                onMealPrepChange={handleMealPrepChange}
              />
            </div>
          </aside>

          <main className="lg:col-span-3">
            <Tabs value={viewMode} onValueChange={(value) => {
              if (value === 'favorites' && !userId) {
                toast.info('Please login to view your favorites');
                return;
              }
              handleViewModeChange(value as 'all' | 'favorites');
            }} className="w-full">
              {/* Pagination at top - sticky (both mobile and desktop) */}
              <div className="sticky top-[73px] z-10 bg-background/95 backdrop-blur-sm border-b pb-4 mb-6 -mx-4 px-4">
                {renderPagination()}
              </div>
              
              <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all" className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Available Meals
                    </TabsTrigger>
                    {userId && (
                      <TabsTrigger value="favorites" className="flex items-center gap-2">
                        <Heart className="h-4 w-4" />
                        Favorites
                        {favoriteDishIds.length > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                            {favoriteDishIds.length}
                          </span>
                        )}
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <p className="text-muted-foreground">
                    {viewMode === 'favorites' 
                      ? `${dishes.length} ${dishes.length === 1 ? 'favorite dish' : 'favorite dishes'}`
                      : `${dishes.length} ${dishes.length === 1 ? 'dish' : 'dishes'} found`}
                    {userPLZ && ` for PLZ ${userPLZ}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSortDirectionToggle}
                    title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedDishes.map((dish) => (
                    <DishCard 
                      key={dish.dish_id} 
                      dish={dish} 
                      onFavorite={userId ? handleFavorite : undefined} 
                    />
                  ))}
                </div>

                {dishes.length === 0 && !loading && (
                  <div className="text-center py-12 space-y-4">
                    <div className="text-6xl mb-4">🍽️</div>
                    <h4 className="text-xl font-semibold">No dishes found</h4>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {!userPLZ 
                        ? 'Enter your postal code to see dishes with current offers in your area.'
                        : 'Try adjusting your filters or check back later for new offers.'}
                    </p>
                    {!userPLZ && (
                      <div className="max-w-md mx-auto mt-4">
                        <PLZInput onPLZChange={handlePLZChange} currentPLZ={userPLZ} />
                      </div>
                    )}
                  </div>
                )}

              </TabsContent>

              <TabsContent value="favorites" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedDishes.map((dish) => (
                    <DishCard 
                      key={dish.dish_id} 
                      dish={dish} 
                      onFavorite={userId ? handleFavorite : undefined} 
                    />
                  ))}
                </div>

                {dishes.length === 0 && !loading && (
                  <div className="text-center py-12 space-y-4">
                    <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-xl font-semibold">No favorite dishes yet</h4>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Start adding dishes to your favorites by clicking the heart icon on any dish card.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => handleViewModeChange('all')}
                      className="mt-4"
                    >
                      Browse All Meals
                    </Button>
                  </div>
                )}

              </TabsContent>
            </Tabs>

          </main>
        </div>
      </div>

      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">© 2025 MealDeal. Alle Rechte vorbehalten.</p>
          <div className="flex justify-center gap-4">
            <Link 
              to={{
                pathname: "/privacy",
                state: { returnSearch: searchParams.toString() }
              }}
              className="hover:text-primary underline"
            >
              Datenschutz
            </Link>
            <Link 
              to={{
                pathname: "/terms",
                state: { returnSearch: searchParams.toString() }
              }}
              className="hover:text-primary underline"
            >
              Nutzungsbedingungen
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
