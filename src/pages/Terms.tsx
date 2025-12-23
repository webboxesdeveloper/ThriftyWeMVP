import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
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

        <h1 className="text-4xl font-bold mb-8">Nutzungsbedingungen</h1>

        <div className="prose prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Geltungsbereich</h2>
            <p className="text-muted-foreground">
              Diese Nutzungsbedingungen regeln die Nutzung der Webseite MealDeal. Durch die Nutzung der Webseite
              erklären Sie sich mit diesen Bedingungen einverstanden.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Leistungsbeschreibung</h2>
            <p className="text-muted-foreground mb-4">
              MealDeal ist eine Plattform, die:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Rezeptvorschläge basierend auf aktuellen Supermarkt-Angeboten bereitstellt</li>
              <li>Regionale Angebote nach PLZ anzeigt</li>
              <li>Preisvergleiche und Einsparungsmöglichkeiten aufzeigt</li>
              <li>Eine kostenlose Nutzung ohne Registrierung ermöglicht</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Nutzungsrechte</h2>
            <p className="text-muted-foreground">
              Die Nutzung von MealDeal ist für Privatpersonen kostenlos. Die gewerbliche Nutzung der Inhalte,
              insbesondere die automatisierte Abfrage von Daten (Scraping), ist ohne ausdrückliche Zustimmung
              nicht gestattet.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Verfügbarkeit und Änderungen</h2>
            <p className="text-muted-foreground">
              Wir bemühen uns um eine ständige Verfügbarkeit der Webseite, können diese jedoch nicht garantieren.
              Wartungsarbeiten oder technische Störungen können zu vorübergehenden Unterbrechungen führen.
              Wir behalten uns das Recht vor, die Webseite jederzeit zu ändern oder einzustellen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Angebotsrichtigkeit</h2>
            <p className="text-muted-foreground">
              Die auf MealDeal angezeigten Angebote basieren auf öffentlich zugänglichen Informationen der
              Supermarktketten. Wir bemühen uns um Aktualität und Richtigkeit, können jedoch keine Gewähr für
              die Vollständigkeit oder Fehlerfreiheit der Angaben übernehmen. Maßgeblich sind die Angebote
              direkt beim jeweiligen Händler.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Haftungsausschluss</h2>
            <p className="text-muted-foreground mb-4">
              Die Nutzung von MealDeal erfolgt auf eigene Verantwortung. Wir haften nicht für:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Fehlerhafte oder veraltete Angebotsinformationen</li>
              <li>Nicht verfügbare Produkte beim Händler</li>
              <li>Abweichende Preise beim tatsächlichen Einkauf</li>
              <li>Technische Störungen oder Datenverlust</li>
              <li>Inhalte verlinkter externer Webseiten</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Urheberrecht</h2>
            <p className="text-muted-foreground">
              Alle auf MealDeal bereitgestellten Inhalte (Rezepte, Texte, Bilder, Grafiken) sind urheberrechtlich
              geschützt. Die Vervielfältigung, Bearbeitung oder Verbreitung bedarf unserer ausdrücklichen Zustimmung.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Externe Links</h2>
            <p className="text-muted-foreground">
              Unsere Webseite enthält Links zu externen Webseiten Dritter. Wir haben keinen Einfluss auf die
              Inhalte dieser Seiten und übernehmen keine Verantwortung für diese.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Änderungen der Nutzungsbedingungen</h2>
            <p className="text-muted-foreground">
              Wir behalten uns vor, diese Nutzungsbedingungen jederzeit zu ändern. Die aktuelle Version finden
              Sie stets auf dieser Seite. Wesentliche Änderungen werden wir auf der Webseite bekannt geben.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Salvatorische Klausel</h2>
            <p className="text-muted-foreground">
              Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam sein oder werden, bleibt die
              Wirksamkeit der übrigen Bestimmungen hiervon unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Anwendbares Recht</h2>
            <p className="text-muted-foreground">
              Für diese Nutzungsbedingungen und die gesamte Rechtsbeziehung zwischen Ihnen und MealDeal gilt
              das Recht der Bundesrepublik Deutschland.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground mb-4">
            Stand: November 2025
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}
