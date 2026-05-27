# Prompt Factory v2 - Self Hosted

Deine persönliche Prompt-Bibliothek - jetzt Self-Hosted!

## Schnellstart

1. **Repository klonen:**
```bash
git clone <repo-url>
cd prompt-factory-v2
```

2. **Umgebungsvariablen setzen:**
```bash
cp .env.example .env
# Bearbeite .env mit deinen Werten
```

3. **Docker Compose starten:**
```bash
docker-compose up -d
```

4. **Datenbank migrieren:**
```bash
docker-compose exec app npx prisma migrate deploy
```

5. **Aufrufen:**
- App: http://localhost
- Direkt: http://localhost:3000

## Backup & Restore

**Backup:**
```bash
docker-compose exec db pg_dump -U postgres promptfactory > backup.sql
```

**Restore:**
```bash
cat backup.sql | docker-compose exec -T db psql -U postgres promptfactory
```

## SSL/HTTPS

Für HTTPS musst du die nginx-Konfiguration anpassen und SSL-Zertifikate einbinden.