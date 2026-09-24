# Focus

Instagram und YouTube ohne Endlos-Feeds – als private iPhone-App.
Kein Konto, kein Backend, kein Tracking, kein Abo.

Focus lädt Instagram (mobile Web) in einer dauerhaften WebView und legt eine
Schutzschicht darüber. Nachrichten, Profile, Stories und Beiträge funktionieren
normal; Reels-Feed, Explore und Vorschläge bleiben draußen.

## Funktionen

**Focus-Start:** Deine Apps als Icons wie auf dem Home-Bildschirm – antippen öffnet,
gedrückt halten (oder *Bearbeiten*) zeigt, was Focus in der App sperrt. Darunter, was für
alle Apps gilt: Nutzungszeit, Graustufen, Verhalten. Der runde Focus-Knopf rechts in der
Leiste führt immer dorthin zurück; jede App behält ihre WebView beim Wechsel.

**YouTube:** Shorts gesperrt (Player, Kanal-Tabs, Regale, Links) · Start = Abos, „Nur Suche“
oder YouTube-Startseite · Trends/Erkunden/Gaming gesperrt · Empfehlungen unter Videos und
Kommentare optional ausgeblendet · eigene Suche mit Vorschlägen beim Tippen · Google-Login
bleibt in Focus.

**Instagram:**

- **Modi:** Ausgewogen (Standard) · Stories + Nachrichten · Nur Nachrichten · Eigene
- **Startseite:** „Folge ich“ (nur Accounts, denen du folgst) · nur Stories · „Für dich“ · aus
- **Gesperrt:** Reels-Feed, einzelne Reels, Profil-Reels, Explore; optional Stories und Gespeichert
- **Reels-Zeitfenster:** 5/10/15 Minuten, Countdown in der Leiste, harter Stopp, nicht verlängerbar, danach mindestens 5 Minuten gesperrt
- **Ausgeblendet:** eindeutig markierte Werbung und Vorschläge, Reels-Einstiege, Instagrams eigene Leiste
- **Suche:** eigene Profilsuche (Name, `@benutzername` oder Link) statt Explore
- **Graustufen**, **Nutzungszeit** (nur lokal), **letzter Ort** nach Neustart
- **Kein Neuladen** bei App-Wechsel, Sperren oder Kontrollzentrum; Lade-Skeletons statt Springen
- Login direkt bei Instagram – Focus sieht und speichert kein Passwort

## Installieren & aktualisieren (SideStore)

Jeder Push baut per GitHub Action eine unsignierte `Focus.ipa` und veröffentlicht sie
als Release. SideStore signiert sie mit deiner Apple-ID und erneuert die 7-Tage-Signatur
selbst (LocalDevVPN, Einrichtung: [docs.sidestore.io](https://docs.sidestore.io)).

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
AirDrop an SideStore. „Focus Dev“ ist eine eigene App, die ihren Code live vom Mac lädt:
`npm start`, gleiches WLAN, lokales Netzwerk erlauben – Änderungen erscheinen sofort.
Neu bauen nur bei nativen Änderungen (Pakete, `ios/`).

Voraussetzungen am Mac: Xcode, Node ≥ 22, `brew install cocoapods`.

### Aufbau

```
src/
  app/FocusApp.tsx          Shell: Tabs, Zustand, Aktionen
  controls/controls.ts      Modi und Schalter → Routen-Policy
  services/services.ts      Die Apps (Name, Beta, User-Agent)
  app/ServiceBrowser.tsx    Browser für YouTube (Guard, Sperre, Laden)
  filtering/
    engine/types.ts         Gemeinsame Sperrgründe, Regel- und App-Typen
    instagram/routes.ts     Instagram-Regeln (versioniert)
    youtube/routes.ts       YouTube-Regeln
    instagram/scripts.ts    In-Page-Guard für WKWebView (Konfiguration je App)
    engine/RouteGuard.ts    Entscheidung für jede Navigation
    engine/messages.ts      Validierung der WebView-Bridge
  search/youtubeSuggest.ts  Suchvorschläge für YouTube
  usage/usage.ts            Lokale Nutzungszeit
  screens/                  WebView, Suche, Focus-Tab, Sperr-/Ladeflächen
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
- Instagram ändert sein Web: unbekannte Routen zeigt der Focus-Tab unter *Filterstatus*;
  Regeln in `routes.ts` anpassen und die Regelversion erhöhen.

## Sicherheit

Keine Geheimnisse im Repo; `.gitignore` schließt Signier-Material, Kopplungsdateien,
`.env` und Builds aus. Commits nur über `noreply`-Adressen. Die Action läuft nur in
diesem Repo und darf nur Releases anlegen. Instagram-Login, Cookies, Einstellungen und
Nutzungszeit liegen ausschließlich auf dem iPhone.

## Grenzen

- Instagram Web ≠ Instagram-App: Kamera, Filter, manche Posting-Funktionen, Anrufe und
  Push-Benachrichtigungen fehlen. Dafür gibt es „Zum Posten: Instagram-App öffnen“.
- Geteilte Reels sind vorerst gesperrt (lieber gesperrt als ein Schlupfloch in den Feed).
- Die offizielle Instagram-App wird nicht gesperrt (kein Screen-Time-Shield ohne
  bezahlten Entwickler-Account).
