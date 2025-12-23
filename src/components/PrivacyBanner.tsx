import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function PrivacyBanner() {
  const location = useLocation();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('privacy-consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('privacy-consent', 'all');
    setShowBanner(false);
  };

  const acceptEssential = () => {
    localStorage.setItem('privacy-consent', 'essential');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Cookie-Einstellungen</h3>
            <p className="text-sm text-muted-foreground">
              Wir verwenden Cookies, um Ihre Präferien zu speichern und die Nutzung zu analysieren.{' '}
              <Link 
                to={{
                  pathname: "/privacy",
                  state: { returnSearch: location.search.replace(/^\?/, '') }
                }}
                className="underline hover:text-primary"
              >
                Mehr erfahren
              </Link>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={acceptEssential}>
              Nur Notwendige
            </Button>
            <Button size="sm" onClick={acceptAll}>
              Alle akzeptieren
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={acceptEssential}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
