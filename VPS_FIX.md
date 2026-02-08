# VPS Deployment - Empty Catalog Fix

## Quick Fix (Recommended)

If your catalogs are returning empty results, run this on your VPS:

```bash
cd /path/to/vixsrc-catalogs
bash scripts/fix-empty-catalogs.sh
```

This script will:
1. ✅ Check if the container is running
2. 📦 Backup your existing database
3. 🔄 Run the update script to populate data
4. ✅ Verify the database is populated
5. 🧪 Test a catalog endpoint

**Expected time**: 10-30 minutes

## Manual Diagnostic

If you want to diagnose the issue first:

```bash
cd /path/to/vixsrc-catalogs
bash scripts/diagnose-database.sh
```

This will show you:
- Database file status and size
- Record counts (movies, TV shows)
- Genre-specific data counts
- Cache file status
- Container status

## Alternative: Copy Local Database

If you have a populated database locally (10,734 movies), you can copy it to the VPS:

```bash
# On your local machine
scp catalog.db user@your-vps-ip:/path/to/vixsrc-catalogs/catalog.db

# On VPS, restart the container
docker-compose restart vixsrc-addon
```

## Verify the Fix

After running the fix, test your catalogs:

```bash
# Test Azione (Action) genre
curl "https://catalogs.iceblinker.vip/catalog/movie/vixsrc_movies/genre=Azione.json" | jq '.metas | length'

# Should return a number > 0
```

Or open Stremio and browse the VixSrc addon catalogs.

## Automatic Updates

To keep your database updated, set up a cron job:

```bash
crontab -e
```

Add this line to run updates daily at 3 AM:
```
0 3 * * * cd /path/to/vixsrc-catalogs && bash scripts/cron_update.sh >> cron_update.log 2>&1
```

## Troubleshooting

### Database is populated but catalogs still empty

Check container logs:
```bash
docker logs vixsrc-addon --tail 100
```

Verify the container can access the database:
```bash
docker exec vixsrc-addon sqlite3 /app/catalog.db "SELECT COUNT(*) FROM movie_metadata;"
```

### Update script fails

Check the update log:
```bash
tail -100 update.log
```

Common issues:
- Network connectivity to TMDB/data sources
- Insufficient disk space
- Memory issues (increase `shm_size` in docker-compose.yml)

### Permissions issues

Fix database permissions:
```bash
chmod 644 catalog.db
chown $(whoami):$(whoami) catalog.db
```

## Need Help?

If the issue persists after trying these steps, check:
1. `addon.log` for service errors
2. `update.log` for update script errors
3. Container logs: `docker logs vixsrc-addon`
