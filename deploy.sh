#!/usr/bin/env bash
set -e

REPO_DIR="/opt/cinehome/repo"

echo "==> Deploy CineHome"

sudo mkdir -p /var/www/html
sudo mkdir -p /opt/cinehome

echo "==> Kopiere Webdateien"
sudo cp "$REPO_DIR/web/index.html" /var/www/html/index.html
sudo cp "$REPO_DIR/web/app.js" /var/www/html/app.js
sudo cp "$REPO_DIR/web/style.css" /var/www/html/style.css

echo "==> Kopiere API"
sudo cp "$REPO_DIR/api/api.py" /opt/cinehome/api.py

echo "==> Kopiere nginx Config"
sudo cp "$REPO_DIR/nginx/nginx-films.conf" /etc/nginx/sites-available/cinehome

echo "==> Kopiere systemd Service"
sudo cp "$REPO_DIR/systemd/cinehome.service" /etc/systemd/system/cinehome.service

if [ ! -L /etc/nginx/sites-enabled/cinehome ]; then
  sudo ln -s /etc/nginx/sites-available/cinehome /etc/nginx/sites-enabled/cinehome
fi

echo "==> Rechte setzen"
sudo chmod 644 /var/www/html/index.html /var/www/html/app.js /var/www/html/style.css
sudo chmod 644 /opt/cinehome/api.py
sudo chmod 644 /etc/nginx/sites-available/cinehome
sudo chmod 644 /etc/systemd/system/cinehome.service

echo "==> Services neu laden"
sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl restart cinehome
sudo systemctl reload nginx

echo "==> Test"
curl -s http://127.0.0.1:5000/api/health || true
