import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/services/api';
import { CSVImportErrors } from './CSVImportErrors';

const CSV_TYPES = {
  // Import order matters - follow this sequence
  lookups_categories: 'Categories (Lookup)',
  lookups_units: 'Units (Lookup)',
  chains: 'Chains',
  ad_regions: 'Ad Regions',
  stores: 'Stores',
  store_region_map: 'Store-Region Mapping',
  ingredients: 'Ingredients',
  dishes: 'Dishes',
  dish_ingredients: 'Dish-Ingredients',
  offers: 'Offers',
  postal_codes: 'Postal Codes',
};

export function CSVImport() {
  const [selectedType, setSelectedType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [importResult, setImportResult] = useState<{
    validRows: number;
    errors: string[];
    imported?: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedType) {
      toast.error('Please select a file and data type');
      return;
    }

    setIsUploading(true);

    try {
      const result = await api.importCSV(file, selectedType, dryRun);

      // Store result for display
      setImportResult(result);

      if (dryRun) {
        if (result.errors.length === 0) {
          toast.success(`Validation complete: ${result.validRows} rows are valid and ready to import`);
        } else {
          toast.warning(`Validation found ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}`, {
            description: 'Please review the errors below and fix them before importing',
            duration: 8000,
          });
        }
      } else {
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Import completed with ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}`, {
            description: result.imported !== undefined ? `${result.imported} rows imported successfully` : 'Some rows may not have been imported',
            duration: 8000,
          });
        } else if (result.imported === undefined) {
          toast.warning(`Import completed but count unavailable. ${result.validRows} rows were validated.`);
        } else {
          toast.success(`Import complete: ${result.imported} rows imported successfully`);
          // Clear form on successful import
          setFile(null);
          setSelectedType('');
          setImportResult(null);
        }
      }
    } catch (error: any) {
      console.error('Import error:', error);
      // Show user-friendly error
      const errorMessage = error.message || 'Import failed';
      setImportResult({
        validRows: 0,
        errors: [errorMessage],
        imported: 0,
      });
      toast.error('Import failed', {
        description: 'Please check the errors below for details',
        duration: 10000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV Import</CardTitle>
        <CardDescription>
          Import data from CSV files. Use dry run to validate before importing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dataType">Data Type</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger id="dataType">
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CSV_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="csvFile">CSV File</Label>
          <Input
            id="csvFile"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="dryRun"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="dryRun" className="font-normal cursor-pointer">
            Dry run (validate only, don't import)
          </Label>
        </div>

        <Button
          onClick={handleUpload}
          disabled={isUploading || !file || !selectedType}
          className="w-full"
        >
          {isUploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
          ) : dryRun ? (
            <><CheckCircle2 className="mr-2 h-4 w-4" /> Validate</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Import</>
          )}
        </Button>

        {/* Error Display */}
        {importResult && (
          <div className="mt-6">
            <CSVImportErrors
              errors={importResult.errors}
              validRows={importResult.validRows}
              imported={importResult.imported}
              isDryRun={dryRun}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
