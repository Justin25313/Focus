# Loopweg

Instagram, YouTube, X und Reddit ohne Endlos-Feeds – als private iPhone-App.
Kein Konto, kein Backend, kein Tracking, kein Abo.

Loopweg lädt Instagram (mobile Web) in einer dauerhaften WebView und legt eine
Schutzschicht darüber. Nachrichten, Profile, Stories und Beiträge funktionieren
normal; Reels-Feed, Explore und Vorschläge bleiben draußen.

## Funktionen

**Loopweg-Start:** Deine Apps als versetzte, zweispaltige Karten mit einer kurzen Beschreibung – antippen öffnet,
gedrückt halten (oder *Bearbeiten*) zeigt, was Loopweg in der App sperrt. Darunter, was für
alle Apps gilt: Nutzungszeit, Graustufen, Verhalten. Der runde Loopweg-Knopf rechts in der
Leiste führt immer dorthin zurück; jede App behält ihre WebView beim Wechsel.

**Gegen das Öffnen aus Gewohnheit:** kurze Pause (3/5/10 s, Atem-Animation) vor jeder App,
auch nach mindestens 5 Minuten Abwesenheit · **Tageslimit pro App** – danach bis morgen zu;
weniger gilt sofort, mehr Zeit oder „Aus“ erst ab morgen.

**Zeitfenster (Reels und Shorts):** 5/10/15 Minuten bewusst freigeben – die Zeit läuft
**nur, solange Reels bzw. Shorts auf dem Bildschirm sind**. Wechsel zu Nachrichten, ins
Loopweg-Menü, in eine andere App oder Loopweg schließen pausiert sie; beim Zurückkommen geht es
genau dort weiter (alle paar Sekunden gespeichert, auch nach einem Absturz). Countdown in
der Leiste, harter Stopp, nicht verlängerbar, übrige Zeit verfällt um Mitternacht; danach
mindestens 5 Minuten gesperrt (so lange wie das Fenster). Auch das Tageslimit zählt nur die
Zeit, in der die App wirklich offen ist.

**YouTube:** Shorts gesperrt (Player, Kanal-Tabs, Regale, Links) – oder per **Shorts-Zeitfenster**
kurz frei (eigener Shorts-Tab mit Countdown) · Start = Abos, „Nur Suche“
oder YouTube-Startseite · Trends/Erkunden/Gaming gesperrt · Empfehlungen unter Videos und
Kommentare optional ausgeblendet · eigene Suche mit Vorschlägen beim Tippen · „Du“ als
native Liste (Verlauf, Später ansehen, Playlists, Mag ich, Kanäle) · Google-Login bleibt in Loopweg.

**X:** nur „Folge ich“ (Loopweg hält den Tab ausgewählt, „Für dich“ und Themen-Tabs wie News
verschwinden; solange das nicht sicher ist, bleibt die Timeline verborgen) · kein Premium-Upsell · Erkunden und Trends gesperrt · eigene
Suche mit `@name` · Leiste: Start, Suche, Mitteilungen, Nachrichten.

**Reddit:** wie die App – eigene Kopfzeile (Communities/Zurück, Suchfeld, +), Leiste Home,
Posteingang, Du · **Home = dein eigener Feed**: nur Beiträge aus den Communities, denen du
beigetreten bist (Loopweg liest die Liste mit deinem Login bei Reddit; vorher: die zuletzt
geöffneten) – ohne Vorschläge · Reddits Startseite, Popular, All und Erkunden gesperrt ·
Werbung ausgeblendet · Suche nach `r/name`, `u/name` oder Beiträgen.

**Instagram:**

- **Modi:** Ausgewogen (Standard) · Stories + Nachrichten · Nur Nachrichten · Eigene
- **Startseite:** „Für dich“ wie in der App (Standard, ohne Reels) · „Gefolgt“ – umschaltbar
  oben über „Für dich ⌄“ · nur Stories · aus
- **Aussehen wie die App:** Startseite mit Instagrams eigener Kopfzeile (+, Für dich ⌄, ♥),
  Profil mit App-Kopfzeile (+, Name ⌄, Menü); dein Profil oben wie in der App (Bild mit +, Name über fetten Zahlen,
  „Bearbeiten“, „Profil teilen“ über das iOS-Teilen-Menü); Profil-Tabs als Symbolzeile mit
  Strich unter dem aktiven Tab; Videos im Feed mit durchsichtiger Kopfzeile; „+“ und „Deine Story“
  fragen, ob die Instagram-App geöffnet werden soll (Posten geht nur dort)
- **Gesperrt:** Reels-Feed, Profil-Reels, Explore; optional Stories und Gespeichert
- **Geteilte Reels:** ein Reel aus dem Chat öffnet sich einzeln – weiterwischen zum nächsten
  geht nur in einem Reels-Zeitfenster (dann zählt die Zeit)
- **Reels-Zeitfenster:** eigener Reels-Tab mit Countdown (siehe Zeitfenster oben)
- **Ausgeblendet:** eindeutig markierte Werbung und Vorschläge, Reels-Einstiege, Instagrams eigene Leiste
- **Suche:** eigene Profilsuche (Name, `@benutzername` oder Link) statt Explore
- **Graustufen**, **Nutzungszeit** (nur lokal), **letzter Ort** nach Neustart
- **Tabs wie in der App:** jeder Tab (Home, Reels, Nachrichten, Suche, Profil) hat eine eigene
  Seite, die ihren Stand behält; seitlich wischen wechselt den Tab, die anderen Tabs laden im
  Hintergrund vor – Wechseln ohne Nachladen
- **Links zu Instagram, YouTube, X oder Reddit** öffnen in Loopweg, nie in den echten Apps –
  aber nur nach einem Tipp; Seiten, die von selbst weiterleiten, holen dich nicht heraus
- **Pro App (gedrückt halten):** „Neu starten“ (zur Startseite, angemeldet bleiben) und
  „Abmelden“ (löscht nur die Daten dieser App)
- **Leiste wird beim Runterscrollen etwas kleiner**, beim Hochscrollen wieder normal (alle Apps)
- **Schnell:** Seitenwechsel ohne Neuladen, die Ladefläche geht, sobald Inhalte da sind
- **Keine „In der App öffnen“-Hinweise:** solche Dialoge beantwortet Focus selbst mit „Nicht
  jetzt“ (oder blendet sie aus), „App öffnen“-Buttons und -Leisten verschwinden; Links und
  Weiterleitungen öffnen nie die echten Apps (Universal Links sind in Focus' WebViews aus)
- **Kein Neuladen** bei App-Wechsel, Sperren oder Kontrollzentrum; Lade-Skeletons statt Springen
- Login direkt bei Instagram – Loopweg sieht und speichert kein Passwort

## Installieren & aktualisieren (SideStore)

Jeder Push baut per GitHub Action eine unsignierte `Focus.ipa` und veröffentlicht sie
als Release. SideStore signiert sie mit deiner Apple-ID und erneuert die 7-Tage-Signatur
selbst (LocalDevVPN, Einrichtung: [docs.sidestore.io](https://docs.sidestore.io)).

Der sichtbare App-Name ist Loopweg. Paketname, Bundle-ID, IPA-Dateiname und
SideStore-Quelle behalten ihre bisherigen technischen Kennungen, damit Updates
und lokale Daten erhalten bleiben.

In SideStore unter **Sources → +** einmal hinzufügen:

```
https://github.com/Justin25313/Focus/releases/latest/download/source.json
```

Updates erscheinen danach in *My Apps* → **Update**. Login und Einstellungen bleiben erhalten.

## Entwicklung

```sh
npm install
npm run check      # Typecheck, Lint, Tests
npm run ipa        # Release-ipa lokal bauen → dist/Focus.ipa
```

**Live auf dem iPhone testen:** einmal `npm run ipa:dev` → `dist/FocusDev.ipa` per
AirDrop an SideStore. „Loopweg Dev“ ist eine eigene App, die ihren Code live vom Mac lädt:
`npm start`, gleiches WLAN, lokales Netzwerk erlauben – Änderungen erscheinen sofort.
Neu bauen nur bei nativen Änderungen (Pakete, `ios/`).

Voraussetzungen am Mac: Xcode, Node ≥ 22, `brew install cocoapods`.

### Aufbau

```
src/
  app/FocusApp.tsx          Shell: Tabs, Zustand, Aktionen
  controls/controls.ts      Modi und Schalter → Routen-Policy
  services/services.ts      Die Apps (Name, Beta, User-Agent)
  app/ServiceBrowser.tsx    Browser für YouTube, X, Reddit (Guard, Sperre, Laden)
  filtering/
    engine/types.ts         Gemeinsame Sperrgründe, Regel- und App-Typen
    instagram/routes.ts     Instagram-Regeln (versioniert)
    youtube/routes.ts       YouTube-Regeln
    x/routes.ts             X-Regeln
    reddit/routes.ts        Reddit-Regeln
    instagram/scripts.ts    In-Page-Guard für WKWebView (Konfiguration je App)
    engine/RouteGuard.ts    Entscheidung für jede Navigation
    engine/messages.ts      Validierung der WebView-Bridge
  search/youtubeSuggest.ts  Suchvorschläge für YouTube
  usage/usage.ts            Lokale Nutzungszeit
  screens/                  WebView, Suche, Loopweg-Tab, Sperr-/Ladeflächen
  storage/                  Einstellungen, Diagnose, Verlauf (AsyncStorage)
  ui/, ui/skeleton/         Theme, Icons, Listen, Tab-Leiste, Skeleton-Bausteine
  ui/tabIcons/              Leisten-Icons als Vorlagen-PNGs (scripts/render-tab-icons.mjs)
ios/Focus/AppDelegate.swift + WebsiteDataJanitor (löscht WebKit-Daten auf Anfrage)
```

- **Zwei Schutzebenen aus denselben Regeln:** nativ vor jedem Seitenaufruf, und in der
  Seite (Instagram ist eine Single-Page-App) über `pushState`-Hooks, Klick-Abfang und
  einen MutationObserver. Landet die Seite doch auf einer gesperrten Route, wird sie
  unsichtbar und stumm geschaltet (fail closed).
- **Bridge:** nur fest definierte Nachrichtentypen, zur Laufzeit validiert, nur von
  `https://www.instagram.com`. Die Seite kann nie Code in der App ausführen.
- **Filter:** nie über Text allein, außer für Werbung/Vorschläge – dort nur bei exakter
  Beschriftung. Lieber einmal Werbung als ein fehlender Beitrag von Freunden.
- Neue Ladezustände immer aus `ui/skeleton/Skeleton.tsx` bauen.
- Die Leisten-Icons sind PNG-Vorlagen, eingefärbt mit der Systemfarbe `labelColor` –
  nur so wechseln sie mit dem Liquid Glass zwischen hell und dunkel. Nach Änderungen an
  den Formen `node scripts/render-tab-icons.mjs` ausführen.
- Instagram ändert sein Web: unbekannte Routen zeigt der Loopweg-Tab unter *Filterstatus*;
  Regeln in `routes.ts` anpassen und die Regelversion erhöhen.

## Sicherheit

Keine Geheimnisse im Repo; `.gitignore` schließt Signier-Material, Kopplungsdateien,
`.env` und Builds aus. Commits nur über `noreply`-Adressen. Die Action läuft nur in
diesem Repo und darf nur Releases anlegen. Instagram-Login, Cookies, Einstellungen und
Nutzungszeit liegen ausschließlich auf dem iPhone.

## Grenzen

- Instagram Web ≠ Instagram-App: Kamera, Filter, manche Posting-Funktionen, Anrufe und
  Push-Benachrichtigungen fehlen. Dafür gibt es „Zum Posten: Instagram-App öffnen“.
- Die offizielle Instagram-App wird nicht gesperrt (kein Screen-Time-Shield ohne
  bezahlten Entwickler-Account).
