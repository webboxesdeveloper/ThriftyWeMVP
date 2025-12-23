import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Zap, ChefHat } from 'lucide-react';

interface DishFiltersProps {
  categories: string[];
  chains: string[];
  selectedCategory: string;
  selectedChain: string;
  maxPrice: number;
  showQuickMeals: boolean;
  showMealPrep: boolean;
  onCategoryChange: (category: string) => void;
  onChainChange: (chain: string) => void;
  onMaxPriceChange: (price: number) => void;
  onQuickMealsChange: (show: boolean) => void;
  onMealPrepChange: (show: boolean) => void;
}

export function DishFilters({
  categories,
  chains,
  selectedCategory,
  selectedChain,
  maxPrice,
  showQuickMeals,
  showMealPrep,
  onCategoryChange,
  onChainChange,
  onMaxPriceChange,
  onQuickMealsChange,
  onMealPrepChange,
}: DishFiltersProps) {
  return (
    <div className="space-y-6 p-4 bg-card rounded-lg border">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Supermarket</Label>
        <Select value={selectedChain} onValueChange={onChainChange}>
          <SelectTrigger>
            <SelectValue placeholder="All supermarkets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {chains.map((chain) => (
              <SelectItem key={chain} value={chain}>
                {chain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Meal Type</Label>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="quick-meals"
              checked={showQuickMeals}
              onCheckedChange={(checked) => onQuickMealsChange(checked === true)}
            />
            <Label
              htmlFor="quick-meals"
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <Zap className="h-4 w-4 text-yellow-500" />
              Quick Meals
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="meal-prep"
              checked={showMealPrep}
              onCheckedChange={(checked) => onMealPrepChange(checked === true)}
            />
            <Label
              htmlFor="meal-prep"
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <ChefHat className="h-4 w-4 text-blue-500" />
              Meal Prep
            </Label>
          </div>
        </div>
      </div>

      <Separator />

      {/* <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Max Price</Label>
          <span className="text-sm font-medium">€{maxPrice}</span>
        </div>
        <Slider
          value={[maxPrice]}
          onValueChange={([value]) => onMaxPriceChange(value)}
          max={50}
          min={5}
          step={1}
        />
      </div> */}
    </div>
  );
}
