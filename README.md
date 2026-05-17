CineHome Refined

Enthaltene Dateien:
- index.html
- style.css
- app.js
- api.py
- nginx-films.conf

Was verbessert wurde:
- Schönere, saubere Oberfläche mit Header-Statistik, Hero-Bereich, Tabs und stabilem Modal-Player.
- Film-Scan deutlich robuster: unterstützt mehrere Root-Pfade, Unterordner, verschiedene Video-/Bild-Dateinamen und mehrere Formate.
- Fallback-Cover eingebaut, falls kein Poster existiert.
- Favoriten und Bewertungen arbeiten mit stabilen IDs.
- Ratings funktionieren wieder über /api/ratings/<movie-id>.

Empfohlene Struktur:
- Frontend nach /var/www/html/
- Filme unter /var/www/html/filme/t7/<Filmordner>/...
- Python API als Systemd-Service auf Port 5000
- Nginx mit der neuen nginx-films.conf

Kurztest:
- http://DEIN-RPI/api/health
- http://DEIN-RPI/api/movies

Wenn /api/health die richtige movies_root meldet und /api/movies Einträge liefert, sollte die Oberfläche die Filme anzeigen.
