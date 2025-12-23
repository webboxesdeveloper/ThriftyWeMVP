import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleBack = () => {
    // Get saved search params from location state
    const returnSearch = (location.state as { returnSearch?: string })?.returnSearch;
    
    if (returnSearch) {
      // Restore the saved query parameters
      navigate(`/${returnSearch ? `?${returnSearch}` : ''}`);
    } else {
      // Try to use browser history
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

        <h1 className="text-4xl font-bold mb-8">Datenschutzerklärung</h1>

        <div className="prose prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Verantwortliche Stelle</h2>
            <p className="text-muted-foreground">
              MealDeal<br />
              Beispielstraße 123<br />
              12345 Berlin<br />
              Deutschland<br />
              E-Mail: datenschutz@mealdeal.de
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Erhebung und Speicherung personenbezogener Daten</h2>
            <p className="text-muted-foreground mb-4">
              Bei der Nutzung unserer Webseite werden folgende Daten erhoben:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Postleitzahl (PLZ) für die Anzeige regionaler Angebote</li>
              <li>Anonymisierte Nutzungs-ID für Session-Management</li>
              <li>Favoriten und Präferenzen (lokal im Browser gespeichert)</li>
              <li>Technische Informationen (IP-Adresse, Browser-Typ, Zugriffszeit)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Zweck der Datenverarbeitung</h2>
            <p className="text-muted-foreground mb-4">
              Wir verwenden Ihre Daten ausschließlich für folgende Zwecke:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Bereitstellung regionaler Angebote und Rezeptvorschläge</li>
              <li>Speicherung Ihrer Favoriten und Einstellungen</li>
              <li>Verbesserung unseres Service und Nutzererlebnis</li>
              <li>Statistische Auswertungen (anonymisiert)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Cookies</h2>
            <p className="text-muted-foreground mb-4">
              Unsere Webseite verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem Endgerät gespeichert werden.
            </p>
            <h3 className="text-xl font-semibold mb-2">Notwendige Cookies</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Session-Management</li>
              <li>Speicherung der PLZ-Eingabe</li>
              <li>Cookie-Einwilligungsstatus</li>
            </ul>
            <h3 className="text-xl font-semibold mb-2">Analyse-Cookies (optional)</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Nutzungsstatistiken (anonymisiert)</li>
              <li>Verbesserung der Webseite</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Weitergabe von Daten</h2>
            <p className="text-muted-foreground">
              Ihre personenbezogenen Daten werden nicht an Dritte weitergegeben, außer wenn dies gesetzlich vorgeschrieben ist
              oder zur Vertragserfüllung notwendig ist.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Ihre Rechte</h2>
            <p className="text-muted-foreground mb-4">
              Sie haben jederzeit das Recht auf:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Auskunft über Ihre gespeicherten Daten</li>
              <li>Berichtigung unrichtiger Daten</li>
              <li>Löschung Ihrer Daten</li>
              <li>Einschränkung der Verarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerspruch gegen die Verarbeitung</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Datensicherheit</h2>
            <p className="text-muted-foreground">
              Wir verwenden geeignete technische und organisatorische Sicherheitsmaßnahmen, um Ihre Daten gegen
              Manipulation, Verlust, Zerstörung oder Zugriff unberechtigter Personen zu schützen. Unsere Sicherheitsmaßnahmen
              werden entsprechend der technologischen Entwicklung fortlaufend verbessert.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Aktualität und Änderung der Datenschutzerklärung</h2>
            <p className="text-muted-foreground">
              Diese Datenschutzerklärung ist aktuell gültig und hat den Stand: November 2025.
              Durch die Weiterentwicklung unserer Webseite kann es notwendig werden, diese Datenschutzerklärung zu ändern.
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
