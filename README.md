# ThriftyWe

**Cook Smart, Save More** - Discover delicious meals based on current supermarket deals in your area.

ThriftyWe is a web application that helps users find and plan meals based on real-time supermarket offers. By entering your postal code (PLZ), the system calculates the best prices for dishes using current ingredient offers from various supermarket chains in your region.

## 🎯 Business Overview

### Problem Statement
Finding affordable meals while shopping can be challenging. Supermarket offers change weekly, and manually calculating which dishes are cheapest based on current deals is time-consuming.

### Solution
MealDeal automatically:
- Aggregates current offers from multiple supermarket chains
- Calculates real-time dish prices based on ingredient offers
- Filters dishes by location (postal code/PLZ)
- Shows savings compared to baseline prices
- Helps users discover meals that are currently on sale

### Target Users
- **Primary:** Budget-conscious home cooks looking to save money on groceries
- **Secondary:** Meal planners who want to optimize their shopping based on current deals
- **Tertiary:** Users looking for quick meal ideas based on available ingredients

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Radix UI** - Accessible component primitives

**Backend:**
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Row Level Security (RLS)
  - Edge Functions (Deno)
  - Real-time subscriptions

**Key Libraries:**
- `@supabase/supabase-js` - Supabase client
- `react-hook-form` + `zod` - Form validation
- `sonner` - Toast notifications
- `lucide-react` - Icons

### Project Structure

```
mealdeal-test/
├── src/
│   ├── components/          # React components
│   │   ├── admin/          # Admin-specific components
│   │   ├── ui/             # Reusable UI components (shadcn)
│   │   ├── DishCard.tsx    # Dish display card
│   │   ├── DishFilters.tsx # Filter sidebar
│   │   └── PLZInput.tsx    # Postal code input
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts      # Authentication logic
│   │   ├── useAdminAuth.ts # Admin authentication
│   │   └── useDishPricing.ts
│   ├── pages/              # Page components
│   │   ├── Index.tsx       # Main dish browsing page
│   │   ├── DishDetail.tsx  # Dish detail view
│   │   ├── AdminDashboard.tsx
│   │   └── Login.tsx
│   ├── services/           # API service layer
│   │   └── api.ts          # Supabase API wrapper
│   └── integrations/       # Third-party integrations
│       └── supabase/       # Supabase client setup
├── supabase/
│   ├── migrations/         # Database migrations
│   ├── functions/          # Edge Functions
│   │   └── import-csv/     # CSV import handler
│   └── seed/               # Seed data SQL
├── data/                    # CSV seed data files
└── public/                  # Static assets
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Supabase account** (free tier works)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mealdeal-test
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create a `.env.local` file in the root directory:
     ```env
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

4. **Run database migrations**
   ```bash
   # Using Supabase CLI (recommended)
   supabase db push
   
   # Or manually run migrations in Supabase SQL Editor
   # Execute files in supabase/migrations/ in order (001, 002, 003, ...)
   ```

5. **Seed initial data (optional)**
   ```bash
   # Run seed SQL files in supabase/seed/ directory
   # Or use the admin dashboard to import CSV files
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open in browser**
   - Navigate to `http://localhost:8080`

### Building for Production

```bash
npm run build
npm run preview
```

## 📊 Database Schema

### Core Tables

**Lookup Tables:**
- `lookups_categories` - Dish categories (e.g., "Main Course", "Dessert")
- `lookups_units` - Measurement units (e.g., "g", "kg", "ml", "l", "stück")

**Location & Chains:**
- `chains` - Supermarket chains (e.g., "Aldi", "Lidl")
- `ad_regions` - Advertising regions for offers
- `stores` - Physical store locations
- `store_region_map` - Maps stores to regions
- `postal_codes` - Maps PLZ (postal codes) to regions

**Products & Dishes:**
- `ingredients` - Individual ingredients with baseline prices
- `dishes` - Meal recipes/dishes
- `dish_ingredients` - Many-to-many relationship (dishes ↔ ingredients)
- `product_map` - Maps aggregator products to ingredients

**Offers:**
- `offers` - Current supermarket offers (region-specific, date-validated)

**User Data:**
- `user_profiles` - User accounts (email, username, PLZ)
- `user_roles` - User roles (user, admin)
- `favorites` - User's favorite dishes
- `plans` - Meal plans (future feature)
- `plan_items` - Items in meal plans
- `plan_item_prices` - Detailed pricing for plan items
- `plan_totals` - Aggregated plan pricing

### Key Relationships

```
chains → ad_regions → postal_codes
chains → stores → store_region_map → ad_regions
dishes ←→ dish_ingredients ←→ ingredients
ingredients ← offers (via region_id)
user_profiles → favorites → dishes
```

### Database Functions

- `calculate_dish_price(dish_id, user_plz)` - Calculates dish pricing based on current offers
- `convert_unit(qty, from_unit, to_unit)` - Converts between compatible units
- `check_email_exists(email)` - Validates email uniqueness
- `check_username_exists(username)` - Validates username uniqueness

## 🔄 Application Workflows

### User Flow

1. **Authentication**
   - User signs up with email, password, optional username and PLZ
   - System creates `user_profiles` record and assigns 'user' role
   - User can sign in with email/password

2. **Location Setup**
   - User enters postal code (PLZ)
   - System validates PLZ exists in `postal_codes` table
   - PLZ is stored in user profile
   - System determines `region_id` from PLZ

3. **Dish Discovery**
   - System fetches dishes from `dishes` table
   - For each dish, calculates pricing using `calculate_dish_price()`:
     - Base price: Sum of ingredient baseline prices
     - Offer price: Uses current offers if available
     - Savings: Difference between base and offer price
   - Filters dishes to show only those with available offers
   - Applies user filters (category, chain, price, quick meals, meal prep)

4. **Dish Details**
   - User clicks on dish card
   - System loads:
     - Dish information
     - Ingredient list with quantities
     - Per-ingredient pricing (baseline vs. offer)
     - Total dish pricing
   - Shows which ingredients have current offers

5. **Favorites**
   - User can favorite/unfavorite dishes
   - Favorites stored in `favorites` table
   - User can view favorites-only view

### Admin Flow

**Security Note:**
Admin functions are secured through a combination of **Row Level Security (RLS)** policies and **Edge Functions**. The CSV import functionality runs server-side via Supabase Edge Functions using the service role key, which bypasses RLS for admin operations. This ensures that:
- Admin operations cannot be performed directly from the client
- Database write access is restricted to authenticated admin users
- Service role key remains server-side only (never exposed to the client)

1. **Admin Authentication**
   - Admin signs in with credentials
   - System checks `user_roles` table for 'admin' role
   - Admin redirected to `/admin/dashboard`

2. **CSV Import**
   - Admin uploads CSV file via admin dashboard
   - System validates CSV format and data
   - Edge Function (`import-csv`) processes file:
     - Parses CSV
     - Validates each row
     - Checks foreign key constraints
     - Inserts/updates data using upsert
   - Returns validation errors and import results

3. **Data Management**
   - Admin can view data tables
   - Admin can import data in correct order:
     1. Lookup tables (categories, units)
     2. Chains and regions
     3. Ingredients
     4. Dishes
     5. Dish-Ingredients
     6. Offers

### Pricing Calculation Workflow

**Important Note on Pricing Logic:**
The current pricing system is **per-unit based** (not entirely quantity-based). The system calculates savings by comparing baseline prices per unit with offer prices per unit. The `dish_ingredients` table's `qty` and `unit` fields are optional and used for reference only - they are not used in the actual pricing calculations. The primary functions (`calculate_dish_aggregated_savings`, `calculate_ingredient_savings_per_unit`) work with per-unit prices rather than total quantities.

1. **User enters PLZ** → System gets `region_id`

2. **For each dish:**
   - Get all required ingredients from `dish_ingredients`
   - For each ingredient:
     - Get baseline price from `ingredients.price_baseline_per_unit`
     - Check for current offers in `offers` table:
       - Match `ingredient_id`
       - Match `region_id`
       - Validate date range (`valid_from <= today <= valid_to`)
     - If offer exists:
       - Convert ingredient quantity to offer unit
       - Calculate: `(qty / pack_size) * price_total`
     - If no offer: Use baseline price
   - Sum all ingredient prices → Total dish price
   - Calculate savings: `base_price - offer_price`

3. **Unit Conversion:**
   - System converts between compatible units:
     - Weight: g ↔ kg
     - Volume: ml ↔ l
     - Pieces: stück ↔ st
   - Non-convertible units (e.g., "EL", "TL", "Bund") use baseline price only

## 🔐 Security & Authentication

### Authentication Methods

1. **Email/Password Authentication**
   - Uses Supabase Auth
   - Email verification optional (configurable)
   - Password requirements enforced by Supabase

2. **Anonymous Users** (Future)
   - System supports anonymous UUIDs
   - Users can browse without account
   - Limited features for anonymous users

### Row Level Security (RLS)

- **Public Tables:** `dishes`, `ingredients`, `chains`, `lookups_*`
- **User-Specific:** `user_profiles`, `favorites` (users can only access their own)
- **Admin-Only:** Most write operations require admin role
- **Read-Only:** Most users have read access to public data

### Authorization

- **User Role:** Default role, can browse and favorite dishes
- **Admin Role:** Can import data, view all tables, manage content

## 📁 Data Import System

### CSV Import Process

1. **File Upload**
   - Admin selects CSV file and table type
   - System sends to Edge Function

2. **Validation**
   - Parses CSV (handles quoted fields, commas)
   - Validates column count matches headers
   - Type conversion (numbers, dates, booleans)
   - Foreign key validation
   - Date format validation (YYYY-MM-DD)

3. **Import**
   - Dry run mode: Validates without importing
   - Live mode: Inserts/updates data using upsert
   - Handles duplicates based on primary keys
   - Returns detailed error messages

### Supported Import Types

- `lookups_categories` - Categories
- `lookups_units` - Units
- `chains` - Supermarket chains
- `ad_regions` - Advertising regions
- `stores` - Store locations
- `postal_codes` - Postal code mappings
- `store_region_map` - Store-region relationships
- `ingredients` - Ingredients
- `dishes` - Dishes
- `dish_ingredients` - Dish-ingredient relationships
- `offers` - Current offers
- `product_map` - Product mappings

### Import Order

Import data in this order to avoid foreign key errors:

1. Lookup tables (categories, units)
2. Chains
3. Ad Regions
4. Stores
5. Postal Codes
6. Store-Region Map
7. Ingredients
8. Dishes
9. Dish-Ingredients
10. Offers
11. Product Map

## 🎨 UI Features

### Main Page (`/`)

- **Header:** Logo, user menu, sign out
- **Hero Section:** PLZ input, tagline
- **Filters Sidebar:**
  - Category filter
  - Chain filter (filtered by PLZ)
  - Max price slider
  - Quick meals toggle
  - Meal prep toggle
- **Dish Grid:**
  - Dish cards with image placeholder
  - Price, savings, category badges
  - Favorite button
  - Sort options (price, savings, name)
- **Tabs:**
  - "Available Meals" - All dishes with offers
  - "Favorites" - User's favorited dishes

### Dish Detail Page (`/dish/:dishId`)

- **Dish Header:** Name, category, tags (quick, meal prep, cuisine, season)
- **Pricing Summary:**
  - Current price (with offers)
  - Base price (strikethrough if higher)
  - Savings badge
  - Available offers count
- **Ingredients List:**
  - Required ingredients (with offer indicators)
  - Optional ingredients
  - Per-ingredient pricing
  - Unit conversion display
- **Favorite Button**

### Admin Dashboard (`/admin/dashboard`)

- **CSV Import Tab:**
  - File upload
  - Table type selection
  - Dry run option
  - Error display
  - Import results
- **View Data Tab:**
  - Table selector
  - Data table with pagination
  - Search and filter

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Configuration

- **Database:** PostgreSQL with extensions (uuid-ossp)
- **Authentication:** Email/Password enabled
- **Storage:** Not currently used
- **Edge Functions:** `import-csv` function deployed

### Build Configuration

- **Port:** 8080 (development)
- **Build Output:** `dist/` directory
- **TypeScript:** Strict mode enabled

## 🧪 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Code Style

- **TypeScript:** Strict mode, no `any` types
- **React:** Functional components with hooks
- **Styling:** Tailwind CSS utility classes
- **Components:** shadcn/ui pattern

### Adding New Features

1. **New Page:**
   - Create component in `src/pages/`
   - Add route in `src/App.tsx`
   - Update navigation if needed

2. **New API Endpoint:**
   - Add method to `src/services/api.ts`
   - Use Supabase client for queries
   - Handle errors appropriately

3. **New Database Table:**
   - Create migration in `supabase/migrations/`
   - Add RLS policies
   - Update TypeScript types (if using generated types)

## 🐛 Troubleshooting

### Common Issues

**"Postal code not found"**
- Ensure PLZ exists in `postal_codes` table
- Check that PLZ is linked to a valid `region_id`

**"No dishes found"**
- Verify offers exist for the user's region
- Check that `valid_from` and `valid_to` dates are current
- Ensure dishes have required ingredients with offers

**"CSV import fails"**
- Check import order (see Data Import System section)
- Verify foreign key references exist
- Ensure date format is YYYY-MM-DD
- Check for extra commas or missing values

**"Authentication errors"**
- Verify Supabase URL and keys in `.env.local`
- Check RLS policies allow user access
- Ensure user profile exists in `user_profiles` table


## 🤝 Contributing

Alex

