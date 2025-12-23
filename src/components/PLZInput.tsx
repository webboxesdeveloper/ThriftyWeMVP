import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PLZInputProps {
  onPLZChange: (plz: string) => void;
  currentPLZ?: string;
}

export function PLZInput({ onPLZChange, currentPLZ }: PLZInputProps) {
  const [plz, setPLZ] = useState(currentPLZ || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedPLZ = plz.trim();
    
    // Validate German PLZ format (5 digits, range 01000-99999)
    if (trimmedPLZ.length !== 5 || !/^\d{5}$/.test(trimmedPLZ)) {
      toast.error('Please enter a valid 5-digit postal code (e.g., 10115)');
      return;
    }
    
    const plzNum = parseInt(trimmedPLZ, 10);
    if (plzNum < 1000 || plzNum > 99999) {
      toast.error('Postal code must be between 01000 and 99999');
      return;
    }

    setIsLoading(true);
    try {
      await onPLZChange(trimmedPLZ);
      // Only show success if no error was thrown
      toast.success('Location updated');
    } catch (error: any) {
      // Error message from API will be more specific (e.g., "Postal code not found")
      toast.error(error?.message || 'Failed to update location. Please check your postal code.');
      // Don't show success message if there was an error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <Label htmlFor="plz" className="sr-only">Postal Code</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="plz"
            type="text"
            placeholder="Enter PLZ (e.g., 10115)"
            value={plz}
            onChange={(e) => {
              // Only allow digits, max 5 characters
              const value = e.target.value.replace(/\D/g, '').slice(0, 5);
              setPLZ(value);
            }}
            maxLength={5}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update
      </Button>
    </form>
  );
}
