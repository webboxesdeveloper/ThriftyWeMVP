import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVImportResult {
  validRows: number;
  errors: string[];
  imported?: number;
}

function generateOfferHash(row: Record<string, any>): string {
  const hashData = [
    row.region_id || '',
    row.ingredient_id || '',
    row.price_total || '',
    row.pack_size || '',
    row.valid_from || '',
    row.valid_to || '',
    row.source_ref_id || '',
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < hashData.length; i++) {
    const char = hashData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function parseCSV(content: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        currentField = '';
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
      }
    } else {
      currentField += char;
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    lines.push(currentLine);
  }

  return lines.filter(line => line.length > 0);
}

function getExpectedColumns(tableType: string): string[] {
  const expectedColumns: Record<string, string[]> = {
    'ad_regions': ['region_id', 'chain_id', 'label'],
    'chains': ['chain_id', 'chain_name'],
    'dish_ingredients': ['dish_id', 'ingredient_id', 'qty', 'unit', 'optional', 'role'], // qty and unit are optional (for assignment only, not calculations)
    'dishes': ['dish_id', 'name', 'category', 'is_quick', 'is_meal_prep', 'season', 'cuisine', 'notes'],
    'ingredients': ['ingredient_id', 'name_canonical', 'unit_default', 'price_baseline_per_unit', 'allergen_tags', 'notes'],
    'offers': ['region_id', 'ingredient_id', 'price_total', 'pack_size', 'unit_base', 'valid_from', 'valid_to', 'source', 'source_ref_id', 'chain_id'],
    'postal_codes': ['plz', 'region_id', 'city'],
    'store_region_map': ['store_id', 'region_id'],
    'stores': ['store_id', 'chain_id', 'store_name', 'plz', 'city', 'street', 'lat', 'lon'],
    'lookups_categories': ['category'],
    'lookups_units': ['unit', 'description'],
  };
  
  return expectedColumns[tableType] || [];
}

function getRequiredFields(tableType: string): Set<string> {
  const requiredFields: Record<string, string[]> = {
    'ad_regions': ['region_id', 'chain_id', 'label'],
    'chains': ['chain_id', 'chain_name'],
    'dish_ingredients': ['dish_id', 'ingredient_id', 'optional', 'role'], // qty and unit are optional (for assignment only, not calculations)
    'dishes': ['dish_id', 'name', 'category', 'is_quick', 'is_meal_prep'],
    'ingredients': ['ingredient_id', 'name_canonical', 'unit_default', 'price_baseline_per_unit'],
    'offers': ['region_id', 'ingredient_id', 'price_total', 'unit_base', 'source', 'chain_id'],
    'postal_codes': ['plz', 'region_id', 'city'],
    'store_region_map': ['store_id', 'region_id'],
    'stores': ['store_id', 'chain_id', 'store_name', 'plz', 'city', 'street'],
  };
  
  return new Set(requiredFields[tableType] || []);
}

function isEmptyValue(value: string): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === '' || 
         trimmed === 'NULL' || 
         trimmed === 'null' ||
         trimmed.length === 0;
}

function validateRow(
  headers: string[],
  row: string[],
  tableType: string
): { valid: boolean; data?: Record<string, any>; error?: string } {
  // For offers table, offer_id might be in CSV but we'll ignore it
  // So allow one extra column if it's offer_id
  const expectedColumns = tableType === 'offers' && headers.includes('offer_id') 
    ? headers.length - 1 
    : headers.length;
  
  if (row.length < expectedColumns || row.length > headers.length) {
    return { 
      valid: false, 
      error: `Wrong number of columns: found ${row.length}, expected ${expectedColumns}-${headers.length}. Check for extra commas or missing values.` 
    };
  }

  const rowData: Record<string, any> = {};
  for (let i = 0; i < headers.length; i++) {
    // Handle case where row might be shorter than headers (missing optional columns)
    const value = (row[i] || '').trim();
    const header = headers[i].trim();

    // Skip offer_id column - it's auto-generated
    if (tableType === 'offers' && header === 'offer_id') {
      continue;
    }

    // Get required fields for this table type
    const requiredFields = getRequiredFields(tableType);
    
    // Check for required fields BEFORE skipping empty values
    // This ensures we validate required fields even if they're empty
    if (requiredFields.has(header)) {
      // This is a required field - validate it's not empty
      if (isEmptyValue(value)) {
        return { 
          valid: false, 
          error: `Invalid ${header}: ${header} cannot be empty or null. ${header} is a required field.` 
        };
      }
    }

    // Skip empty values for optional fields (but not for offers pack_size or dish_ingredients qty/unit which have special handling)
    // Also don't skip if it's a required field (already validated above)
    if (isEmptyValue(value) && 
        !(tableType === 'offers' && header === 'pack_size') &&
        !(tableType === 'dish_ingredients' && (header === 'qty' || header === 'unit')) &&
        !requiredFields.has(header)) {
      rowData[header] = null;
      continue;
    }

    // Type conversions based on table schema
    switch (tableType) {
      case 'offers':
        // Skip offer_id - it's auto-generated (SERIAL)
        if (header === 'offer_id') {
          // Ignore this column - offer_id is auto-generated
          continue;
        }
        if (header === 'region_id') {
          // region_id is now TEXT, so just use the value as-is
          // Empty check already done in required fields validation above
          rowData[header] = value;
        } else if (header === 'ingredient_id') {
          // Convert numeric ID to text ID format (e.g., 1 -> I001, 2 -> I002)
          // If it's already in text format, keep it
          if (/^\d+$/.test(value)) {
            // It's a number, convert to I001 format
            const num = parseInt(value, 10);
            rowData[header] = `I${String(num).padStart(3, '0')}`;
          } else {
            // Already in text format
            rowData[header] = value;
          }
        } else if (header === 'price_total') {
          // price_total is required
          const num = parseFloat(value.replace(',', '.'));
          if (isNaN(num)) {
            return { valid: false, error: `Invalid number for ${header}: "${value}". Use numbers only (e.g., 1.99 or 1,99).` };
          }
          if (num < 0) {
            return { valid: false, error: `Invalid ${header}: "${value}". Numbers cannot be negative.` };
          }
          rowData[header] = num;
        } else if (header === 'pack_size') {
          // pack_size is required but can be empty in CSV - set to 1.0 as default
          if (value === '' || value === 'NULL' || value === 'null') {
            // Default to 1.0 if empty (assumes 1 unit)
            rowData[header] = 1.0;
          } else {
            const num = parseFloat(value.replace(',', '.'));
            if (isNaN(num)) {
              return { valid: false, error: `Invalid number for ${header}: "${value}". Use numbers only (e.g., 1.99 or 1,99), or leave empty.` };
            }
            if (num < 0) {
              return { valid: false, error: `Invalid ${header}: "${value}". Numbers cannot be negative.` };
            }
            if (num === 0) {
              // If 0, default to 1.0
              rowData[header] = 1.0;
            } else {
              rowData[header] = num;
            }
          }
        } else if (header === 'valid_from' || header === 'valid_to') {
          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value)) {
            return { valid: false, error: `Invalid date format for ${header}: "${value}". Use format YYYY-MM-DD (e.g., 2025-01-13).` };
          }
          // Check if date is valid
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { valid: false, error: `Invalid date for ${header}: "${value}". Date does not exist (e.g., 2025-13-45 is invalid).` };
          }
          rowData[header] = value; // Date as string
        } else {
          rowData[header] = value;
        }
        break;

      case 'dishes':
        if (header === 'is_quick' || header === 'is_meal_prep') {
          rowData[header] = value.toUpperCase() === 'TRUE';
        } else {
          rowData[header] = value;
        }
        break;

      case 'dish_ingredients':
        if (header === 'qty') {
          // qty is optional - allow empty/null values
          if (isEmptyValue(value)) {
            rowData[header] = null; // Allow NULL for optional qty
          } else {
          const num = parseFloat(value.replace(',', '.'));
          if (isNaN(num)) {
              return { valid: false, error: `Invalid quantity: "${value}". Use numbers only (e.g., 250 or 250,5), or leave empty.` };
          }
          if (num <= 0) {
              return { valid: false, error: `Invalid quantity: "${value}". Quantity must be greater than 0, or leave empty.` };
          }
          rowData[header] = num;
          }
        } else if (header === 'unit') {
          // unit is optional - allow empty/null values
          if (isEmptyValue(value)) {
            rowData[header] = null; // Allow NULL for optional unit
          } else {
            rowData[header] = value; // Store unit as-is if provided
          }
        } else if (header === 'optional') {
          rowData[header] = value.toUpperCase() === 'TRUE';
        } else {
          rowData[header] = value;
        }
        break;

      case 'ingredients':
        if (header === 'price_baseline_per_unit') {
          // price_baseline_per_unit is required, so validate it's a valid number
          const num = parseFloat(value.replace(',', '.'));
          if (isNaN(num)) {
            return { valid: false, error: `Invalid price_baseline_per_unit: "${value}". Must be a valid number (e.g., 1.99 or 1,99).` };
          }
          if (num < 0) {
            return { valid: false, error: `Invalid price_baseline_per_unit: "${value}". Price cannot be negative.` };
          }
          rowData[header] = num;
        } else if (header === 'allergen_tags') {
          rowData[header] = value ? value.split(',').map(t => t.trim()) : null;
        } else {
          rowData[header] = value;
        }
        break;

      case 'ad_regions':
        // Required fields (label, region_id, chain_id) are already validated earlier
        // Just assign the value here
        rowData[header] = value;
        break;

      default:
        rowData[header] = value;
    }
  }

  return { valid: true, data: rowData };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role key to bypass RLS for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const tableType = formData.get('type') as string;
    const dryRun = formData.get('dryRun') === 'true';

    if (!file || !tableType) {
      return new Response(
        JSON.stringify({ error: 'Missing file or type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = await file.text();
    const lines = parseCSV(content);

    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: 'CSV must have at least a header and one data row' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = lines[0].map(h => h.trim());
    const dataRows = lines.slice(1);

    // Validate CSV headers match expected columns for this table type
    const expectedColumns = getExpectedColumns(tableType);
    
    if (expectedColumns.length > 0) {
      // For offers table, offer_id might be in CSV but we'll ignore it
      const headersToCheck = tableType === 'offers' && headers.includes('offer_id')
        ? headers.filter(h => h !== 'offer_id')
        : headers;
      
      const expectedColumnsSet = new Set(expectedColumns);
      const headersSet = new Set(headersToCheck);
      
      // Check for unexpected columns (columns in CSV that aren't expected)
      const unexpectedColumns = headersToCheck.filter(h => !expectedColumnsSet.has(h));
      
      // Check for missing required columns (columns expected but not in CSV)
      const requiredFields = getRequiredFields(tableType);
      const missingRequiredColumns = Array.from(requiredFields).filter(col => !headersSet.has(col));
      
      if (unexpectedColumns.length > 0) {
        return new Response(
          JSON.stringify({
            validRows: 0,
            errors: [
              `CSV column validation failed: The CSV contains columns that are not expected for the "${tableType}" table.`,
              `Unexpected columns found: ${unexpectedColumns.join(', ')}`,
              `Expected columns for "${tableType}" table: ${expectedColumns.join(', ')}`,
              `Your CSV columns: ${headers.join(', ')}`,
              ``,
              `Please check:`,
              `1. Make sure you selected the correct table type`,
              `2. Remove or rename unexpected columns`,
              `3. Verify column names match exactly (case-sensitive)`,
            ],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (missingRequiredColumns.length > 0) {
        return new Response(
          JSON.stringify({
            validRows: 0,
            errors: [
              `CSV column validation failed: Required columns are missing for the "${tableType}" table.`,
              `Missing required columns: ${missingRequiredColumns.join(', ')}`,
              `Expected columns for "${tableType}" table: ${expectedColumns.join(', ')}`,
              `Your CSV columns: ${headers.join(', ')}`,
              ``,
              `Please add the missing required columns to your CSV file.`,
            ],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const result: CSVImportResult = {
      validRows: 0,
      errors: [],
    };

    const validRows: Record<string, any>[] = [];

    // Validate all rows
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      const validation = validateRow(headers, row, tableType);

      if (!validation.valid) {
        // Add row number, error message, and row data for context
        const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
        const errorMsg = validation.error || 'Unknown validation error';
        
        // Create a table-like row data display for the error message
        const rowDataTable = headers.map((h, idx) => {
          const val = (row[idx] || '').trim() || '(empty)';
          return `  ${h}: "${val}"`;
        }).join('\n');
        
        // Include row data in error message for better debugging
        // Format: Error message, then row data in a readable format
        result.errors.push(
          `Row ${rowNum}: ${errorMsg}\n` +
          `Row Data:\n${rowDataTable}`
        );
        continue;
      }

      // Add offer hash for offers table
      if (tableType === 'offers' && validation.data) {
        try {
        validation.data.offer_hash = generateOfferHash(validation.data);
        } catch (hashError: any) {
          const rowNum = i + 2;
          result.errors.push(`Row ${rowNum}: Failed to generate offer hash - ${hashError.message || 'Unknown error'}`);
          continue;
        }
      }

      validRows.push(validation.data!);
      result.validRows++;
    }

    // If dry run, return validation results
    if (dryRun) {
      result.imported = undefined; // Explicitly set to undefined for dry run
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (validRows.length > 0) {
      let insertError = null;
      let insertedCount = 0;
      
      // Handle different conflict resolution based on table type
      if (tableType === 'offers') {
        // Offers table has offer_hash for deduplication
        for (const row of validRows) {
          const { data: regionCheck, error: regionError } = await supabaseClient
          // Check region_id exists
          const { data: regionCheck, error: regionError } = await supabaseClient
            .from('ad_regions')
            .select('region_id')
            .eq('region_id', row.region_id)
            .single();
          
          if (regionError || !regionCheck) {
            const rowIndex = validRows.indexOf(row) + 2;
            const errorMsg = `Region ID "${row.region_id}" not found in ad_regions table. Make sure you've imported ad_regions first.`;
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = regionError || new Error(errorMsg);
            continue;
          }
          
          // Check ingredient_id exists
          const { data: ingredientCheck, error: ingredientError } = await supabaseClient
            .from('ingredients')
            .select('ingredient_id')
            .eq('ingredient_id', row.ingredient_id)
            .single();
          
          if (ingredientError || !ingredientCheck) {
            const rowIndex = validRows.indexOf(row) + 2;
            const errorMsg = `Ingredient ID "${row.ingredient_id}" not found in ingredients table. Make sure you've imported ingredients first.`;
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = ingredientError || new Error(errorMsg);
            continue;
          }
          
          // Check unit_base exists in lookups_units
          if (row.unit_base) {
            const { data: unitCheck, error: unitError } = await supabaseClient
              .from('lookups_units')
              .select('unit')
              .eq('unit', row.unit_base)
              .single();
            
            if (unitError || !unitCheck) {
              const rowIndex = validRows.indexOf(row) + 2;
              const errorMsg = `Unit "${row.unit_base}" not found in lookups_units table. Make sure you've imported units lookup first.`;
              result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
              if (!insertError) insertError = unitError || new Error(errorMsg);
              continue;
            }
          }
          
          const { data: chainCheck, error: chainError } = await supabaseClient
            .from('chains')
            .select('chain_id')
            .eq('chain_id', row.chain_id)
            .single();
          
          if (chainError || !chainCheck) {
            const rowIndex = validRows.indexOf(row) + 2;
            const errorMsg = `Chain ID "${row.chain_id}" not found in chains table. Make sure you've imported chains first.`;
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = chainError || new Error(errorMsg);
            continue;
          }
          
          // For offers, we need to handle SERIAL offer_id properly
          // upsert doesn't work well with SERIAL columns, so we check first and then insert/update
          // Explicitly create insert/update object with only the fields we want (exclude offer_id, created_at, updated_at)
          const insertData: Record<string, any> = {
            region_id: row.region_id,
            ingredient_id: row.ingredient_id,
            price_total: row.price_total,
            pack_size: row.pack_size,
            unit_base: row.unit_base,
            valid_from: row.valid_from,
            valid_to: row.valid_to,
            offer_hash: row.offer_hash,
            source: row.source, // source is required
            chain_id: row.chain_id, // chain_id is required
          };
          
          // Add optional fields only if they exist
          if (row.source_ref_id !== null && row.source_ref_id !== undefined) {
            insertData.source_ref_id = row.source_ref_id;
          }
          
          // Check if offer_hash already exists
          const { data: existingOffer, error: checkError } = await supabaseClient
            .from(tableType)
            .select('offer_id')
            .eq('offer_hash', row.offer_hash)
            .maybeSingle();
          
          if (checkError && checkError.code !== 'PGRST116') {
          }
          
          let error, data;
          if (existingOffer && existingOffer.offer_id) {
            // Update existing offer
            const { error: updateError, data: updateDataResult } = await supabaseClient
              .from(tableType)
              .update(insertData)
              .eq('offer_hash', row.offer_hash)
              .select();
            error = updateError;
            data = updateDataResult;
          } else {
            // Insert new offer (SERIAL will auto-generate offer_id, timestamps will auto-generate)
            // Make absolutely sure offer_id, created_at, updated_at are not in the insert data
            const finalInsertData = { ...insertData };
            delete (finalInsertData as any).offer_id;
            delete (finalInsertData as any).created_at;
            delete (finalInsertData as any).updated_at;
            
            const { error: insertError, data: insertDataResult } = await supabaseClient
            .from(tableType)
              .insert(finalInsertData)
            .select();
            
            error = insertError;
            data = insertDataResult;
          }
          if (error) {
            const rowIndex = validRows.indexOf(row) + 2;
            const errorAny = error as any;
            let errorMsg = error.message || 'Unknown error';
            
            // Enhance error message with context
            if (error.message?.includes('foreign key') || errorAny.code === '23503') {
              if (error.message.includes('region_id') || errorAny.details?.includes('region_id')) {
                errorMsg = `Region ID "${row.region_id}" not found. Import ad_regions first.`;
              } else if (error.message.includes('ingredient_id') || errorAny.details?.includes('ingredient_id')) {
                errorMsg = `Ingredient ID "${row.ingredient_id}" not found. Import ingredients first.`;
              } else if (error.message.includes('unit_base') || errorAny.details?.includes('unit_base')) {
                errorMsg = `Unit "${row.unit_base}" not found. Import units lookup first.`;
              } else {
                errorMsg = `Foreign key constraint violation: ${error.message}`;
              }
            } else if (error.message?.includes('duplicate') || error.message?.includes('unique constraint') || errorAny.code === '23505') {
              errorMsg = `Offer with this hash already exists. The row will be updated.`;
              // This is OK for upsert, so we can continue
              if (data && data.length > 0) {
                insertedCount++;
                continue;
              }
            } else {
              errorMsg = `Database error: ${error.message || 'Unknown error'}`;
              if (errorAny.details) errorMsg += ` (${errorAny.details})`;
              if (errorAny.hint) errorMsg += ` Hint: ${errorAny.hint}`;
            }
            
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = error;
            continue;
          }
          if (data && data.length > 0) {
            insertedCount++;
          }
        }
      } else if (tableType === 'lookups_categories' || tableType === 'lookups_units') {
        // Lookup tables use the first column as primary key
        const primaryKey = headers[0];
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: primaryKey,
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'chains') {
        // Chains table uses chain_id or chain_name as unique
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: 'chain_id',
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'ingredients') {
        // Ingredients uses ingredient_id as primary key
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: 'ingredient_id',
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'dishes') {
        // Dishes uses dish_id as primary key
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: 'dish_id',
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'ad_regions') {
        // Ad regions uses composite primary key (region_id, chain_id)
        // This allows the same region_id to be used across different chains
        for (const row of validRows) {
          const { data: chainCheck, error: chainError } = await supabaseClient
          const { data: chainCheck, error: chainError } = await supabaseClient
            .from('chains')
            .select('chain_id')
            .eq('chain_id', row.chain_id)
            .single();
          
          if (chainError || !chainCheck) {
            const rowIndex = validRows.indexOf(row) + 2;
            const errorMsg = `Chain ID "${row.chain_id}" not found in chains table. Make sure you've imported chains first.`;
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = chainError || new Error(errorMsg);
            continue;
          }
          
        const { error, data } = await supabaseClient
          .from(tableType)
            .upsert(row, { 
            onConflict: 'region_id,chain_id',  // Composite primary key
            ignoreDuplicates: false 
          })
          .select();
          if (error) {
            const rowIndex = validRows.indexOf(row) + 2;
            let errorMsg = error.message || 'Unknown error';
            
            // Enhance error message with context
            const errorAny = error as any;
            if (error.message?.includes('foreign key') || errorAny.code === '23503') {
              if (error.message.includes('chain_id') || errorAny.details?.includes('chain_id')) {
                errorMsg = `Chain ID "${row.chain_id}" not found. Import chains first.`;
              } else {
                errorMsg = `Foreign key constraint violation: ${error.message}`;
              }
            } else if (error.message?.includes('duplicate') || error.message?.includes('unique constraint') || errorAny.code === '23505') {
              errorMsg = `Region ID "${row.region_id}" already exists. The row will be updated with new values.`;
              // This is actually OK for upsert, so we can continue
              if (data && data.length > 0) {
                insertedCount++;
                continue;
              }
            } else {
              const errorAny = error as any;
              errorMsg = `Database error: ${error.message || 'Unknown error'}`;
              if (errorAny.details) errorMsg += ` (${errorAny.details})`;
              if (errorAny.hint) errorMsg += ` Hint: ${errorAny.hint}`;
            }
            
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = error;
            continue;
          }
          if (data && data.length > 0) {
            insertedCount++;
          }
        }
      } else if (tableType === 'stores') {
        // Stores uses store_id as primary key
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: 'store_id',
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'postal_codes') {
        // Postal codes uses plz as primary key
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: 'plz',
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'store_region_map') {
        // Store region map has composite primary key (store_id, region_id)
        // Supabase doesn't support composite keys in onConflict, so we need to insert one by one
        for (const row of validRows) {
          const { error, data } = await supabaseClient
            .from(tableType)
            .upsert(row, { 
              onConflict: 'store_id,region_id',
              ignoreDuplicates: false 
            })
            .select();
          if (error) {
            const rowIndex = validRows.indexOf(row) + 2;
            let errorMsg = error.message || 'Unknown error';
            
            // Enhance error message with context
            if (error.message?.includes('foreign key')) {
              if (error.message.includes('store_id')) {
                errorMsg = `Store ID "${row.store_id}" not found. Import stores first.`;
              } else if (error.message.includes('region_id')) {
                errorMsg = `Region ID "${row.region_id}" not found. Import ad_regions first.`;
              }
            }
            
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = error;
            continue; // Continue with next row
          }
          if (data && data.length > 0) insertedCount++;
        }
      } else if (tableType === 'product_map') {
        // Product map uses aggregator_product_id as primary key
        const { error, data } = await supabaseClient
          .from(tableType)
          .upsert(validRows, { 
            onConflict: 'aggregator_product_id',
            ignoreDuplicates: false 
          })
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      } else if (tableType === 'dish_ingredients') {
        // Dish ingredients has composite primary key (dish_id, ingredient_id)
        // Supabase doesn't support composite keys in onConflict, so we need to insert one by one
        for (const row of validRows) {
          const { error, data } = await supabaseClient
            .from(tableType)
            .upsert(row, { 
              onConflict: 'dish_id,ingredient_id',
              ignoreDuplicates: false 
            })
            .select();
          if (error) {
            const rowIndex = validRows.indexOf(row) + 2;
            let errorMsg = error.message || 'Unknown error';
            
            // Enhance error message with context
            if (error.message?.includes('foreign key')) {
              if (error.message.includes('dish_id')) {
                errorMsg = `Dish ID "${row.dish_id}" not found. Import dishes first.`;
              } else if (error.message.includes('ingredient_id')) {
                errorMsg = `Ingredient ID "${row.ingredient_id}" not found. Import ingredients first.`;
              } else if (error.message.includes('unit')) {
                errorMsg = `Unit "${row.unit}" not found. Import units lookup first.`;
              }
            }
            
            result.errors.push(`Row ${rowIndex}: ${errorMsg}`);
            if (!insertError) insertError = error;
            continue; // Continue with next row
          }
          if (data && data.length > 0) insertedCount++;
        }
      } else {
        // For other tables, use regular insert (will fail on duplicates)
        const { error, data } = await supabaseClient
          .from(tableType)
          .insert(validRows)
          .select();
        insertError = error;
        if (data) insertedCount = data.length;
      }

      if (insertError && insertedCount === 0) {
        const errorAny = insertError as any;
        result.imported = insertedCount;
        
        // Extract detailed error message
        let errorMsg = insertError.message || 'Unknown error';
        const errorMsgLower = errorMsg.toLowerCase();
        
        // Provide user-friendly error messages based on error type
        if (errorMsgLower.includes('foreign key') || errorMsgLower.includes('violates foreign key')) {
          // Foreign key errors - provide specific guidance
          if (tableType === 'ingredients') {
            result.errors.push('Import Error: Unit not found');
            result.errors.push(`The unit_default value in your CSV does not exist in the lookups_units table.`);
            result.errors.push(`Fix: Import "Units (Lookup)" CSV file first, then verify unit names match exactly.`);
          } else if (tableType === 'dishes') {
            result.errors.push('Import Error: Category not found');
            result.errors.push(`The category value in your CSV does not exist in the lookups_categories table.`);
            result.errors.push(`Fix: Import "Categories (Lookup)" CSV file first, then verify category names match exactly.`);
          } else if (tableType === 'dish_ingredients') {
            result.errors.push('Import Error: Reference data missing');
            result.errors.push(`One or more references in your CSV do not exist:`);
            result.errors.push(`- dish_id must exist in dishes table (import dishes first)`);
            result.errors.push(`- ingredient_id must exist in ingredients table (import ingredients first)`);
            result.errors.push(`- unit must exist in lookups_units table (import units lookup first)`);
          } else if (tableType === 'offers') {
            result.errors.push('Import Error: Reference data missing');
            result.errors.push(`One or more references in your CSV do not exist:`);
            result.errors.push(`- region_id must exist in ad_regions table (import ad_regions first)`);
            result.errors.push(`- ingredient_id must exist in ingredients table (import ingredients first)`);
            result.errors.push(`- unit_base must exist in lookups_units table (import units lookup first)`);
          } else if (tableType === 'ad_regions') {
            result.errors.push('Import Error: Chain not found');
            result.errors.push(`The chain_id in your CSV does not exist in the chains table.`);
            result.errors.push(`Fix: Import "Chains" CSV file first.`);
          } else if (tableType === 'stores') {
            result.errors.push('Import Error: Chain not found');
            result.errors.push(`The chain_id in your CSV does not exist in the chains table.`);
            result.errors.push(`Fix: Import "Chains" CSV file first.`);
          } else if (tableType === 'postal_codes') {
            result.errors.push('Import Error: Region not found');
            result.errors.push(`The region_id in your CSV does not exist in the ad_regions table.`);
            result.errors.push(`Fix: Import "Ad Regions" CSV file first.`);
          } else if (tableType === 'store_region_map') {
            result.errors.push('Import Error: Reference data missing');
            result.errors.push(`Either store_id or region_id in your CSV does not exist.`);
            result.errors.push(`Fix: Import "Stores" and "Ad Regions" CSV files first.`);
          } else {
            result.errors.push(`Import Error: Reference data missing`);
            result.errors.push(`Some data referenced in your CSV does not exist. Make sure to import data in the correct order.`);
          }
        } else if (errorMsgLower.includes('row-level security') || errorMsgLower.includes('policy') || errorMsgLower.includes('rls')) {
          result.errors.push('Import Error: Permission denied');
          result.errors.push(`The import function does not have permission to write to the database.`);
          result.errors.push(`Fix: Contact your administrator. This is a system configuration issue.`);
        } else if (errorMsgLower.includes('duplicate') || errorMsgLower.includes('unique constraint')) {
          // Duplicate errors are usually OK (upsert will handle), but inform user
          result.errors.push(`Note: Some records already exist and will be updated.`);
          if (insertError.details) {
            result.errors.push(`Details: ${insertError.details}`);
          }
        } else {
          // Generic error with details
          const errorAny = insertError as any;
          result.errors.push(`Import Error: ${errorMsg}`);
          if (errorAny.details) {
            result.errors.push(`Details: ${errorAny.details}`);
          }
          if (errorAny.hint) {
            result.errors.push(`Hint: ${errorAny.hint}`);
          }
        }
        
        return new Response(
          JSON.stringify(result),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (insertError && insertedCount > 0) {
        if (!result.errors.some(e => e.includes('Partial import'))) {
          result.errors.push(`Partial import: ${insertedCount} rows imported, but some errors occurred.`);
        }
      }

      result.imported = insertedCount || validRows.length;
      
      // If there were errors but some rows were imported, still return success with warnings
      if (insertError && insertedCount > 0 && result.errors.length > 0) {
        // Return 200 with errors in the response
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      result.imported = 0;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        details: error.details || error.toString(),
        stack: error.stack,
        validRows: 0,
        errors: [`Import failed: ${error.message || 'Unknown error'}`]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

