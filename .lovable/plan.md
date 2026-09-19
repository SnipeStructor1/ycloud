# yLearn: Sprachen, Themes, Limits & Rangliste

Vier Erweiterungen auf der bestehenden App.

## 1. Vier Sprachen

Deutsch, Englisch, Französisch, Spanisch für die komplette Oberfläche (Menü, Landing, Explore, Dashboard, Lernmodi, Quiz, Tutor, Meldungen).

- Sprachumschalter oben rechts im Menü, Auswahl wird im Browser gespeichert.
- Startsprache richtet sich nach der Browsersprache, Deutsch als Rückfall.
- Der KI-Tutor und die Kartenerstellung antworten in der gewählten Sprache.

## 2. Farbthemen

Fünf Themes: Violett (aktuell), Lime, Orange, Cyan, Pink — alle dunkel.

- Umschaltbar über ein Farbmenü in der Kopfzeile, Auswahl bleibt gespeichert.
- Gleichzeitig ein Design-Feinschliff: lebendigere Verläufe, weichere Karten, animierte Hover-Effekte, größere Überschriften.

## 3. KI-Limit: 2 Sets pro Tag

- Jeder Account kann pro Tag zwei Sets erzeugen.
- Auf der Erstellen-Seite steht sichtbar „Heute noch X von 2 Sets übrig“.
- Beim Erreichen des Limits wird der Knopf gesperrt mit Hinweis, wann es weitergeht (Mitternacht UTC).
- Dein eigener Account bekommt Admin-Status und damit kein Limit.
- Die Zählung läuft serverseitig, nicht im Browser — sie lässt sich nicht umgehen.

## 4. Globale Rangliste

Neue Seite „Rangliste“ im Menü, offen für alle (auch ohne Login sichtbar).

- Punkte = gelernte Karten (1 Punkt) + richtige Quizantworten (2 Punkte) + aktueller Streak (10 Punkte pro Tag).
- Top 100 mit Platz, Anzeigename, Punkten, Streak und Anzahl erstellter Sets.
- Dein eigener Platz wird hervorgehoben, auch wenn du nicht in den Top 100 bist.
- Punkte aktualisieren sich automatisch beim Lernen und nach jedem Quiz.

## 5. Privat/Öffentlich

Der Schalter existiert bereits auf jeder Set-Seite. Er bleibt, bekommt aber Übersetzungen und wird zusätzlich direkt auf den Set-Kacheln im Dashboard angezeigt.

## Technische Umsetzung

**Datenbank (eine Migration)**
- `user_roles` Tabelle + `app_role` Enum + `has_role()` Security-Definer-Funktion; Thibauts Account bekommt `admin`.
- `set_generations` (user_id, day, count) für das Tageslimit, owner-only RLS.
- `quiz_results` (user_id, set_id, correct, total) für Quiz-Punkte.
- `leaderboard_stats` Tabelle (user_id, display_name, cards_learned, quiz_points, streak, sets_created, points) — öffentlich lesbar (`TO anon, authenticated` SELECT), Schreibzugriff nur über Trigger/Security-Definer-Funktionen. So bleibt `profiles` weiter owner-only.
- `user_settings` (locale, theme) owner-only, damit Sprache/Theme geräteübergreifend gelten.
- GRANTs für jede neue Tabelle.

**Frontend**
- `src/lib/i18n.tsx`: leichter Provider mit vier Wörterbüchern, `useT()` Hook, kein zusätzliches Paket nötig.
- `src/lib/theme.tsx`: setzt `data-theme` auf `<html>`; `src/styles.css` bekommt pro Theme einen Token-Block (nur `--primary`/`--accent`/Glow ändern sich).
- `SiteHeader` bekommt Sprach- und Farbwähler.
- Neue Route `src/routes/leaderboard.tsx`.

**Server**
- `generateStudySet` prüft vor dem KI-Aufruf das Tageslimit (Admin ausgenommen) und zählt hoch; Zielsprache wird an den Prompt übergeben.
- `askTutor` und `generateQuiz` bekommen die Sprache ebenfalls.
- Neue Serverfunktion `getGenerationQuota` für die Anzeige auf der Erstellen-Seite.
- Punkte-Updates laufen über eine Security-Definer-Funktion, die `leaderboard_stats` für den eingeloggten Nutzer neu berechnet.
