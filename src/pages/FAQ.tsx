import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function FAQ() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleBack = () => {
    const returnSearch = (location.state as { returnSearch?: string })?.returnSearch;
    
    if (returnSearch) {
      navigate(`/${returnSearch ? `?${returnSearch}` : ''}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" className="mb-6" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>

        <h1 className="text-4xl font-bold mb-8">FAQ</h1>

        <div className="prose prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">How do we calculate the savings?</h2>
            <p className="text-muted-foreground mb-4">
              We calculate the savings per dish based on the current weekly specials in your region. For each main and side ingredient, we check if it is on sale this week. If so, we compare the regular base price with the current sale price. The savings result from the price difference. Ingredients not included in the offer are not taken into account.
            </p>
            <p className="text-muted-foreground mb-4">
              The displayed savings refer exclusively to ingredients that are actually discounted.
            </p>
            <p className="text-muted-foreground">
              Prices and offers are based on the currently valid retailer brochures and are valid for the specified period.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}

