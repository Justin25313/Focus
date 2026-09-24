# Focus

Instagram ohne Reels, Explore und algorithmischen Ballast – als private iPhone-App.
Kein Konto, kein Backend, kein Tracking, kein Abo.

Focus lädt Instagram (mobile Web) in einer dauerhaften WebView und legt eine
Schutzschicht darüber: Reels-Feed und Explore sind gesperrt, Nachrichten,
Profile, Stories und Beiträge funktionieren normal.

> Stand: **Meilenstein 1 + 2** aus dem PRD (stabile WebView-Hülle, Routen-Schutz),
> plus eine native Profilsuche als Ersatz für das gesperrte Explore.
> Voreinstellungen (Balanced, Nur Nachrichten, …), Feed-Filter, Graustufen und
> Nutzungszeit folgen in Meilenstein 3–6.

---

## Was schon funktioniert

| Bereich | Verhalten |
| --- | --- |
| **Start** | Focus öffnet direkt Instagram (abschaltbar). Erster Start: ein kurzer Willkommensbildschirm. |
| **Login** | Direkt bei Instagram in der WebView. Focus sieht und speichert dein Passwort nie. Die Sitzung bleibt nach Neustarts erhalten (persistenter WebKit-Datenspeicher). |
| **Kein Neuladen** | Die WebView wird genau einmal erzeugt. App-Wechsel, Kontrollzentrum, Sperren/Entsperren und Tab-Wechsel laden Instagram nicht neu – Route und Scrollposition bleiben. |
| **Reels** | `/reels/…`, `/reel/…` und Profil-Reels-Tabs sind gesperrt. Reels-Links in der Navigation sind ausgeblendet. |
| **Explore** | `/explore/…` (Raster, Hashtags, Orte) ist gesperrt. Ein Tipp auf Instagrams Such-Icon öffnet stattdessen die Focus-Suche. |
| **Suche** | Eigener Tab: Namen oder `@benutzername` eingeben, oder einen Instagram-Link einfügen. Nutzt Instagrams eigene Kontosuche – ohne Vorschläge, ohne Raster. |
| **Nachrichten** | Eigener Tab, springt direkt in `/direct/inbox/`. |
| **Letzter Ort** | Nach einem echten Neustart geht es beim letzten sicheren Ort weiter (Feed, DMs, Profil, Beitrag – nie Reels, Explore oder Login-Seiten). |
| **Links** | Externe Links öffnen in Safari. Unbekannte App-Schemata (z. B. `instagram://`) werden blockiert. |
| **Posten** | Einfache Posts gehen evtl. über Instagram Web. Für alles andere: „Zum Posten: Instagram-App öffnen“ im Focus-Tab. |
| **Diagnose** | Filterstatus, Regelversion, letzte Sperre, unbekannte Routen, Fehler – nur lokal. |
| **Daten** | „Instagram-Websitedaten löschen“ (Cookies, Cache, Login) und „Focus zurücksetzen“. |

### iPhone 15 Pro

- Layout über Safe-Area-Insets: Dynamic Island oben, Home-Indikator unten.
- 120-Hz-ProMotion ist aktiviert (`CADisableMinimumFrameDurationOnPhone`).
- Nur Hochformat, nur iPhone, Hell- und Dunkelmodus folgen dem System.
- Mindestversion iOS 16.

---

## Auf dein iPhone installieren (kostenlos, Xcode Personal Team)

### Einmalig vorbereiten (Mac)

1. **Xcode** aus dem Mac App Store installieren und einmal öffnen (Zusatzkomponenten installieren lassen).
2. **Node.js ≥ 22** installieren, z. B. mit Homebrew: `brew install node`
3. **CocoaPods** über Ruby/Bundler: `sudo gem install bundler` (einmalig)
4. Repository klonen und Abhängigkeiten installieren:

   ```sh
   git clone https://github.com/Justin25313/Focus.git
   cd Focus
   npm install
   npm run pods        # = cd ios && bundle install && bundle exec pod install
   ```

### In Xcode signieren

1. `ios/Focus.xcworkspace` öffnen (**die .xcworkspace, nicht die .xcodeproj**).
2. Links das Projekt **Focus** → Target **Focus** → Tab **Signing & Capabilities**.
3. **Team:** dein Apple-Account („Personal Team“). Falls noch keiner da ist: *Add an Account…*
4. **Bundle Identifier:** ist `com.justin25313.focus`. Meldet Xcode, dass er vergeben ist, ändere ihn auf etwas Eigenes (z. B. `com.deinname.focus`).

### Release-Build auf dem iPhone

Damit Focus ohne laufenden Mac funktioniert, muss das JavaScript in die App gebündelt werden:

1. Menü **Product → Scheme → Edit Scheme… → Run → Build Configuration: Release**.
2. iPhone per Kabel verbinden, oben als Ziel auswählen.
3. **iPhone vorbereiten** (nur beim ersten Mal):
   - *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* einschalten, iPhone neu starten.
4. In Xcode **▶︎ Run** (⌘R).
5. Beim ersten Start sagt iOS „Nicht vertrauenswürdiger Entwickler“:
   *Einstellungen → Allgemein → VPN & Geräteverwaltung → dein Apple-Account → Vertrauen*.

### Alle 7 Tage neu signieren

Mit einem kostenlosen Personal Team läuft das Zertifikat nach 7 Tagen ab. Dann
startet Focus nicht mehr – einfach iPhone anschließen und in Xcode erneut **▶︎ Run**.
Deine Instagram-Anmeldung und die Focus-Einstellungen bleiben dabei erhalten.

### Empfohlenes Setup

1. Instagram-App vom Home-Bildschirm entfernen („Aus Home-Bildschirm entfernen“ – sie bleibt in der App-Mediathek).
2. Focus an ihren Platz legen.
3. „Instagram beim Start öffnen“ eingeschaltet lassen.

---

## Entwicklung

```sh
npm start           # Metro-Bundler (für Debug-Builds)
npm run ios         # Build + Start im Simulator
npm run check       # Typecheck + Lint + Tests
```

Im Debug-Build ist die WebView über Safari → Entwickler → *[iPhone]* inspizierbar
(`webviewDebuggingEnabled`), praktisch für die QA der Instagram-Routen.

### Architektur

```
App.tsx
src/
  app/FocusApp.tsx              Shell: Tabs, Zustand, Persistenz, Aktionen
  screens/
    BrowserView.tsx             Die eine Instagram-WebView (nie neu gemountet)
    BlockedOverlay.tsx          Nativer Sperrbildschirm
    SearchScreen.tsx            Focus-Suche (Ersatz für Explore)
    SettingsScreen.tsx          Focus-Tab: Verhalten, Diagnose, Daten
    OnboardingScreen.tsx        Erster Start
  filtering/
    instagram/routes.ts         Einzige Quelle der Routen-Regeln (+ Versionsnummer)
    instagram/scripts.ts        In-Page-Guard (läuft bei document-start in WKWebView)
    instagram/search.ts         Eingabe-Interpretation der Suche
    engine/RouteGuard.ts        Entscheidung für jede Navigation
    engine/messages.ts          Validierung der WebView-Bridge
  storage/                      Einstellungen, letzter Ort, Diagnose, Suchverlauf (AsyncStorage)
  ui/                           Theme, Icons, gruppierte Listen, Tab-Leiste
ios/Focus/AppDelegate.swift     + WebsiteDataJanitor (löscht WebKit-Daten auf Anfrage)
```

**Zwei Schutzebenen, beide aus denselben Regeln (`routes.ts`):**

1. **Nativ** – `onShouldStartLoadWithRequest` prüft jede echte Navigation, bevor
   sie lädt; `onNavigationStateChange` prüft zusätzlich jede URL-Änderung.
2. **In der Seite** – Instagram ist eine Single-Page-App, viele Wechsel laufen über
   `history.pushState`. Der Guard hängt sich in `pushState`/`replaceState`/`popstate`
   ein, fängt Klicks auf gesperrte Links ab, bevor Instagrams Router sie sieht,
   und prüft zusätzlich jede Sekunde die URL. Landet die Seite doch auf einer
   gesperrten Route, wird sie sofort unsichtbar geschaltet und alle Videos pausiert
   (fail closed); „Zurück“ geht per `history.back()` zurück – ohne Neuladen.

**Bridge:** Die Seite kann nur sechs fest definierte Nachrichtentypen senden
(`FILTER_READY`, `FILTER_ERROR`, `ROUTE_CHANGED`, `BLOCKED_ROUTE`, `OPEN_SEARCH`,
`SEARCH_RESULTS`). Jede Nachricht wird zur Laufzeit validiert; Nachrichten von
anderen Origins als `https://www.instagram.com` werden verworfen.

**Websitedaten löschen:** Instagrams Session-Cookie ist `HttpOnly` und von JS aus
unerreichbar. Statt eines eigenen Native-Moduls schreibt JS über React Natives
`Settings`-API ein Flag in `NSUserDefaults`; der `WebsiteDataJanitor` im
`AppDelegate` löscht dann den kompletten `WKWebsiteDataStore` und meldet Vollzug.

### Routen-Annahmen

Siehe Kommentar in [`src/filtering/instagram/routes.ts`](src/filtering/instagram/routes.ts).
Instagram ändert sein Web regelmäßig – bei der QA auf dem iPhone unbedingt prüfen
und neue Varianten dort eintragen (und die Regelversion erhöhen).
Unbekannte Routen erscheinen im Focus-Tab unter *Filterstatus → Unbekannte Route*.

---

## Bekannte Grenzen

- Instagram Web ≠ Instagram-App: Kamera, Filter, manche Posting- und Creator-Funktionen,
  Anrufe und Push-Benachrichtigungen fehlen.
- Geteilte Reels sind vorerst **komplett** gesperrt (PRD §12/§55: lieber gesperrt als
  ein Schlupfloch in den Reels-Feed). Der Sperrbildschirm bietet an, das Reel einmal in
  der Instagram-App zu öffnen.
- Die Namenssuche nutzt Instagrams internen Such-Endpunkt. Ändert Instagram ihn,
  funktioniert weiterhin das direkte Öffnen per `@benutzername` oder Link.
- Die offizielle Instagram-App wird nicht gesperrt (kein Screen-Time-Shield ohne
  kostenpflichtigen Entwickler-Account – geplant als optionaler Meilenstein 7).

## Manuelle QA-Checkliste (iPhone)

- [ ] Login, 2FA, Logout, Neustart → noch angemeldet
- [ ] Home-Feed, DM-Inbox, DM-Unterhaltung, Profil, Beitrag, Karussell, Story
- [ ] Reels-Tab / Reels-Link / Profil-Reels → Sperrbildschirm, „Zurück“ ohne Neuladen
- [ ] Such-Icon in Instagram → Focus-Suche; Hashtag-Link → Explore-Sperre
- [ ] Geteiltes Reel in DMs → Sperrbildschirm, „Einmal in der Instagram-App öffnen“
- [ ] Profil öffnen, scrollen, Kontrollzentrum + Helligkeit → gleiche Position
- [ ] DM öffnen, 30 s in Nachrichten-App, zurück → gleiche DM
- [ ] Video abspielen, sperren, innerhalb 30 s entsperren → kein Sprung zum Feed
- [ ] App beenden, neu starten → letzter sicherer Ort
- [ ] Flugmodus → „Instagram ist nicht erreichbar“ → „Erneut versuchen“
- [ ] Externer Link im Profil → Safari
- [ ] Websitedaten löschen → abgemeldet
