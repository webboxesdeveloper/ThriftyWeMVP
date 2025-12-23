import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, XCircle, Info, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface CSVImportErrorsProps {
  errors: string[];
  validRows: number;
  imported?: number;
  isDryRun: boolean;
}

// Map technical errors to user-friendly messages with fixes
function getUserFriendlyError(error: string): {
  title: string;
  description: string;
  fix: string[];
  severity: 'error' | 'warning' | 'info';
} {
  const lowerError = error.toLowerCase();

  // Label validation errors for ad_regions
  if (lowerError.includes('invalid label') || lowerError.includes('label cannot be empty')) {
    return {
      title: 'Empty Label Field',
      description: 'The label column in your ad_regions CSV contains an empty or null value. Label is a required field.',
      fix: [
        '1. Check your CSV file for rows with empty label values',
        '2. Ensure every row has a value in the label column',
        '3. Label should be a descriptive name for the region (e.g., "REWE_NORD", "LIDL_BERLIN")',
        '4. Remove or fill in any empty label cells before importing',
      ],
      severity: 'error',
    };
  }

  // Foreign key constraint errors
  if (lowerError.includes('foreign key') || lowerError.includes('violates foreign key')) {
    if (lowerError.includes('unit_default') || lowerError.includes('lookups_units')) {
      return {
        title: 'Unit Not Found',
        description: 'The unit specified in your CSV does not exist in the system.',
        fix: [
          '1. Check that the unit value matches exactly (case-sensitive)',
          '2. Import the "Units (Lookup)" CSV file first',
          '3. Verify the unit exists in lookups_units table',
          '4. Common units: g, kg, l, ml, st, Stück, EL, TL, Bund, Zehen',
        ],
        severity: 'error',
      };
    }
    if (lowerError.includes('category') || lowerError.includes('lookups_categories')) {
      return {
        title: 'Category Not Found',
        description: 'The category specified in your CSV does not exist in the system.',
        fix: [
          '1. Check that the category value matches exactly (case-sensitive)',
          '2. Import the "Categories (Lookup)" CSV file first',
          '3. Verify the category exists in lookups_categories table',
          '4. Common categories: Hauptgericht, Dessert, Snack, etc.',
        ],
        severity: 'error',
      };
    }
    if (lowerError.includes('ingredient_id') || lowerError.includes('ingredients')) {
      return {
        title: 'Ingredient Not Found',
        description: 'The ingredient ID specified in your CSV does not exist.',
        fix: [
          '1. Import the "Ingredients" CSV file first',
          '2. Check that ingredient_id matches exactly (e.g., I001, I002)',
          '3. Verify the ingredient exists in the ingredients table',
        ],
        severity: 'error',
      };
    }
    if (lowerError.includes('dish_id') || lowerError.includes('dishes')) {
      return {
        title: 'Dish Not Found',
        description: 'The dish ID specified in your CSV does not exist.',
        fix: [
          '1. Import the "Dishes" CSV file first',
          '2. Check that dish_id matches exactly (e.g., D001, D002)',
          '3. Verify the dish exists in the dishes table',
        ],
        severity: 'error',
      };
    }
    if (lowerError.includes('region_id') || lowerError.includes('ad_regions')) {
      return {
        title: 'Region Not Found',
        description: 'The region ID specified in your CSV does not exist.',
        fix: [
          '1. Import the "Ad Regions" CSV file first',
          '2. Check that region_id is a valid number (e.g., 500, 501)',
          '3. Verify the region exists in the ad_regions table',
        ],
        severity: 'error',
      };
    }
    if (lowerError.includes('chain_id') || lowerError.includes('chains')) {
      return {
        title: 'Chain Not Found',
        description: 'The chain ID specified in your CSV does not exist.',
        fix: [
          '1. Import the "Chains" CSV file first',
          '2. Check that chain_id is a valid number (e.g., 10, 11)',
          '3. Verify the chain exists in the chains table',
        ],
        severity: 'error',
      };
    }
    return {
      title: 'Reference Data Missing',
      description: 'Some data referenced in your CSV does not exist in the database.',
      fix: [
        '1. Make sure you import data in the correct order',
        '2. Check the import order guide in the documentation',
        '3. Verify all referenced data exists before importing',
      ],
      severity: 'error',
    };
  }

  // Column count errors
  if (lowerError.includes('columns') || lowerError.includes('column')) {
    return {
      title: 'Wrong Number of Columns',
      description: 'The number of columns in your CSV row does not match the expected format.',
      fix: [
        '1. Check that your CSV has the correct number of columns',
        '2. Make sure there are no extra commas or missing values',
        '3. Verify the header row matches the expected format',
        '4. Check for empty rows or formatting issues',
      ],
      severity: 'error',
    };
  }

  // Invalid number errors
  if (lowerError.includes('invalid number') || lowerError.includes('nan') || lowerError.includes('parsefloat')) {
    return {
      title: 'Invalid Number Format',
      description: 'A number in your CSV could not be read correctly.',
      fix: [
        '1. Check that numbers use dots (.) or commas (,) as decimal separators',
        '2. Remove any text or special characters from number fields',
        '3. For German format, use comma: 3,75 (will be converted automatically)',
        '4. For English format, use dot: 3.75',
      ],
      severity: 'error',
    };
  }

  // Date errors
  if (lowerError.includes('date') || lowerError.includes('valid_from') || lowerError.includes('valid_to')) {
    return {
      title: 'Invalid Date Format',
      description: 'A date in your CSV is not in the correct format.',
      fix: [
        '1. Use the format: YYYY-MM-DD (e.g., 2025-01-13)',
        '2. Make sure dates are valid (not 2025-13-45)',
        '3. Check that valid_from is before valid_to',
      ],
      severity: 'error',
    };
  }

  // Duplicate key errors
  if (lowerError.includes('duplicate') || lowerError.includes('unique') || lowerError.includes('already exists')) {
    return {
      title: 'Duplicate Entry',
      description: 'This record already exists in the database.',
      fix: [
        '1. This is usually OK - the system will update existing records',
        '2. If you want to avoid duplicates, check your CSV for repeated entries',
        '3. The import will update existing records with new data',
      ],
      severity: 'warning',
    };
  }

  // RLS errors
  if (lowerError.includes('row-level security') || lowerError.includes('policy') || lowerError.includes('rls')) {
    return {
      title: 'Permission Error',
      description: 'The import function does not have permission to write to the database.',
      fix: [
        '1. This is a system configuration issue',
        '2. Contact your administrator',
        '3. Make sure SUPABASE_SERVICE_ROLE_KEY is configured',
      ],
      severity: 'error',
    };
  }

  // Row number errors
  if (lowerError.includes('row')) {
    const rowMatch = error.match(/row\s+(\d+)/i);
    if (rowMatch) {
      return {
        title: `Error in Row ${rowMatch[1]}`,
        description: error,
        fix: [
          `1. Check row ${rowMatch[1]} in your CSV file`,
          '2. Make sure all required fields are filled',
          '3. Verify the data format matches the expected format',
        ],
        severity: 'error',
      };
    }
  }

  // Generic error
  return {
    title: 'Import Error',
    description: error,
    fix: [
      '1. Check your CSV file format',
      '2. Verify all required columns are present',
      '3. Make sure data types match (text, numbers, dates)',
      '4. Try running a dry run first to see all errors',
    ],
    severity: 'error',
  };
}

export function CSVImportErrors({ errors, validRows, imported, isDryRun }: CSVImportErrorsProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  if (errors.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Success!</AlertTitle>
        <AlertDescription className="text-green-700">
          {isDryRun ? (
            <>
              Validation complete: <strong>{validRows} rows</strong> are valid and ready to import.
            </>
          ) : (
            <>
              Import complete: <strong>{imported || 0} rows</strong> imported successfully.
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const errorGroups = errors.map((error, index) => ({
    original: error,
    friendly: getUserFriendlyError(error),
    index,
  }));

  const errorCount = errorGroups.filter(e => e.friendly.severity === 'error').length;
  const warningCount = errorGroups.filter(e => e.friendly.severity === 'warning').length;

  const toggleError = (index: number) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedErrors(newExpanded);
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Import Issues Found
            </CardTitle>
            <CardDescription className="text-red-600 mt-1">
              {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
              {errorCount > 0 && warningCount > 0 && ' and '}
              {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
              {' found. '}
              {validRows > 0 && `${validRows} row${validRows !== 1 ? 's' : ''} are valid.`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {errorCount > 0 && <Badge variant="destructive">{errorCount} Errors</Badge>}
            {warningCount > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-700">{warningCount} Warnings</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorGroups.map(({ original, friendly, index }) => {
          const isExpanded = expandedErrors.has(index);
          const Icon = friendly.severity === 'error' ? XCircle : friendly.severity === 'warning' ? AlertCircle : Info;

          return (
            <Collapsible key={index} open={isExpanded} onOpenChange={() => toggleError(index)}>
              <Alert
                className={
                  friendly.severity === 'error'
                    ? 'border-red-200 bg-red-50'
                    : friendly.severity === 'warning'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-blue-200 bg-blue-50'
                }
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`h-4 w-4 mt-0.5 ${
                      friendly.severity === 'error'
                        ? 'text-red-600'
                        : friendly.severity === 'warning'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <AlertTitle
                      className={
                        friendly.severity === 'error'
                          ? 'text-red-800'
                          : friendly.severity === 'warning'
                          ? 'text-yellow-800'
                          : 'text-blue-800'
                      }
                    >
                      {friendly.title}
                    </AlertTitle>
                    <AlertDescription
                      className={
                        friendly.severity === 'error'
                          ? 'text-red-700'
                          : friendly.severity === 'warning'
                          ? 'text-yellow-700'
                          : 'text-blue-700'
                      }
                    >
                      {friendly.description}
                    </AlertDescription>

                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 text-xs"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Hide Fix Instructions
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show How to Fix
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-3">
                      <div
                        className={`rounded-md p-3 space-y-1 ${
                          friendly.severity === 'error'
                            ? 'bg-red-100 border border-red-200'
                            : friendly.severity === 'warning'
                            ? 'bg-yellow-100 border border-yellow-200'
                            : 'bg-blue-100 border border-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <HelpCircle className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-semibold text-gray-800">How to Fix:</span>
                        </div>
                        {friendly.fix.map((fixStep, fixIndex) => (
                          <div key={fixIndex} className="text-sm text-gray-700 pl-6">
                            {fixStep}
                          </div>
                        ))}
                      </div>
                      {original !== friendly.description && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            Show technical details
                          </summary>
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                            {original}
                          </pre>
                        </details>
                      )}
                    </CollapsibleContent>
                  </div>
                </div>
              </Alert>
            </Collapsible>
          );
        })}

        {validRows > 0 && (
          <Alert className="border-green-200 bg-green-50 mt-4">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Valid Rows</AlertTitle>
            <AlertDescription className="text-green-700">
              {validRows} row{validRows !== 1 ? 's' : ''} {isDryRun ? 'are valid' : 'were imported successfully'}.
              {errors.length > 0 && ' Fix the errors above and try again to import all rows.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}



