#!/bin/bash
# VixSrc Catalog - Quick Fix for Empty Catalogs
# This script populates the database by running the update script

set -e  # Exit on error

echo "========================================="
echo "VixSrc Catalog - Database Population"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ ERROR: docker-compose.yml not found"
    echo "   Please run this script from the vixsrc-catalogs directory"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q vixsrc-addon; then
    echo "⚠️  Container 'vixsrc-addon' is not running"
    echo "   Starting container..."
    docker-compose up -d
    echo "   Waiting for container to be ready..."
    sleep 5
fi

echo "✅ Container is running"
echo ""

# Backup existing database if it exists and has data
if [ -f "catalog.db" ]; then
    DB_SIZE=$(stat -f%z "catalog.db" 2>/dev/null || stat -c%s "catalog.db" 2>/dev/null || echo "0")
    if [ "$DB_SIZE" -gt 10000 ]; then
        BACKUP_NAME="catalog.db.backup.$(date +%Y%m%d_%H%M%S)"
        echo "📦 Backing up existing database to $BACKUP_NAME"
        cp catalog.db "$BACKUP_NAME"
        echo "✅ Backup created"
        echo ""
    fi
fi

# Run the update script
echo "🔄 Running database update script..."
echo "   This may take 10-30 minutes depending on data sources"
echo "   You can monitor progress in update.log"
echo ""

# Run the update script inside the container
docker exec vixsrc-addon xvfb-run --auto-servernum --server-args="-screen 0 1280x800x24" node scripts/nightly-update.js

echo ""
echo "========================================="
echo "Verifying Database Population"
echo "========================================="

# Wait a moment for database to be written
sleep 2

# Check record counts
MOVIE_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM movie_metadata;" 2>/dev/null || echo "0")
TV_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM tv_metadata;" 2>/dev/null || echo "0")

echo "Movies in database: $MOVIE_COUNT"
echo "TV shows in database: $TV_COUNT"
echo ""

if [ "$MOVIE_COUNT" -gt 1000 ]; then
    echo "✅ Database successfully populated!"
    echo ""
    echo "Testing catalog endpoint..."
    
    # Test a catalog endpoint
    CATALOG_URL="http://localhost:3015/catalog/movie/vixsrc_movies/genre=Azione.json"
    RESULT=$(curl -s "$CATALOG_URL" | jq -r '.metas | length' 2>/dev/null || echo "0")
    
    if [ "$RESULT" -gt 0 ]; then
        echo "✅ Catalog endpoint working! Found $RESULT movies in Azione genre"
        echo ""
        echo "========================================="
        echo "SUCCESS! Your catalogs are now populated."
        echo "========================================="
        echo ""
        echo "Next steps:"
        echo "1. Test in Stremio to verify catalogs load"
        echo "2. Set up cron job for automatic updates (see scripts/cron_update.sh)"
    else
        echo "⚠️  Database populated but catalog endpoint returned 0 results"
        echo "   This might be a genre mapping issue. Check logs for details."
    fi
else
    echo "❌ Database population may have failed"
    echo "   Check update.log for errors"
    echo "   You may need to manually populate the database"
fi
