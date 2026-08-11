# MMM-plus-supermarkt-punten

MagicMirror-module die met Playwright inlogt op de mobiele PLUS-site en het gespaarde puntensaldo toont. De browser draait in de Node-helper; je inloggegevens komen daardoor niet in de MagicMirror-browser terecht.

## Installeren

Plaats deze map in `MagicMirror/modules/MMM-plus-supermarkt-punten` en voer in de modulemap uit:

```sh
npm install
npm run install-browser
```

Kopieer `settings.example.json` naar `settings.json` en vul je eigen gegevens in:

```json
{
  "username": "jouw-emailadres@example.nl",
  "password": "jouw-wachtwoord",
  "headless": true,
  "localPort": 8080
}
```

`settings.json` staat in `.gitignore` en wordt dus niet per ongeluk gecommit.

Voeg de module toe aan `config/config.js` van MagicMirror:

```js
{
  module: "MMM-plus-supermarkt-punten",
  position: "top_right",
  config: {
    updateInterval: 60 * 60 * 1000
  }
}
```

## Lokaal gebruiken

MagicMirror is niet nodig voor de lokale modus:

```sh
npm run local
```

Open daarna <http://localhost:8080>. De pagina haalt bij het starten meteen nieuwe gegevens op. Met **Vernieuwen** start je de scraper nogmaals; wijzigingen in `settings.json` worden daarbij opnieuw ingelezen.

## Zelf de route naar de punten aanwijzen

Gebruik de opnamemodus als er na het inloggen nog door de PLUS-site geklikt moet worden:

```sh
npm run record
```

De scraper logt automatisch in en pauzeert daarna. Er staan dan twee vensters open:

1. Klik in het Chromium-venster zelf door naar het scherm met je punten.
2. Klik daarna in **Playwright Inspector** op **Resume** (de driehoek bovenin).
3. Sluit het Chromium-venster niet zelf. Na Resume wordt `plus-navigation.zip` opgeslagen en sluit de browser automatisch.

Het tracebestand bevat screenshots en de uitgevoerde browseracties. Het staat in `.gitignore`, omdat er persoonlijke accountinformatie in beeld kan staan. Deel het bestand daarom niet publiek; binnen deze lokale workspace kan het worden gebruikt om de juiste klikken aan de scraper toe te voegen.

Na het inloggen opent de scraper automatisch **Sparen met de app** en daarna de kaart **PLUSpunten**. De module toont het totale aantal punten, de verdeling tussen volle kaarten en losse punten, en de al inwisselbare geldwaarde. Als het saldo door een wijziging aan de PLUS-site niet meer wordt herkend, toont de lokale pagina relevante regels met woorden als `punten`, `sparen` of `saldo`. Zet eventueel tijdelijk `"debug": true` in `settings.json`; dan ontstaat `plus-debug.png` in de modulemap.

## Instellingen

| Instelling | Betekenis | Standaard |
|---|---|---|
| `username` | E-mailadres van Mijn PLUS | verplicht |
| `password` | Wachtwoord van Mijn PLUS | verplicht |
| `headless` | Browservenster verbergen | `true` |
| `localPort` | Poort van de lokale modus | `8080` |
| `debug` | Screenshot na login opslaan | `false` |

De scraper weigert de cookiebanner, opent **Inloggen**, vult `#Input_EmailFirst` en `#Input_Password` en verzendt het formulier. Er is bewust geen testframework en geen `npm test`-script toegevoegd.
