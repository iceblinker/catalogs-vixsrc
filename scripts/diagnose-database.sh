#!/bin/bash
# VixSrc Catalog Database Diagnostic Script
# Run this on the VPS to diagnose empty catalog issues

echo "========================================="
echo "VixSrc Catalog Database Diagnostics"
echo "========================================="
echo ""

# Check if database file exists
if [ ! -f "catalog.db" ]; then
    echo "❌ ERROR: catalog.db not found in current directory"
    echo "   Current directory: $(pwd)"
    exit 1
fi

echo "✅ Database file found: catalog.db"
echo "   Size: $(du -h catalog.db | cut -f1)"
echo "   Last modified: $(stat -c %y catalog.db 2>/dev/null || stat -f "%Sm" catalog.db)"
echo ""

# Check database integrity
echo "Checking database integrity..."
sqlite3 catalog.db "PRAGMA integrity_check;" > /tmp/integrity_check.txt
if grep -q "ok" /tmp/integrity_check.txt; then
    echo "✅ Database integrity: OK"
else
    echo "❌ Database integrity: FAILED"
    cat /tmp/integrity_check.txt
fi
echo ""

# Check table counts
echo "========================================="
echo "Table Record Counts"
echo "========================================="
MOVIE_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM movie_metadata;" 2>/dev/null || echo "0")
TV_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM tv_metadata;" 2>/dev/null || echo "0")

echo "Movies: $MOVIE_COUNT"
echo "TV Shows: $TV_COUNT"
echo ""

if [ "$MOVIE_COUNT" -eq 0 ] && [ "$TV_COUNT" -eq 0 ]; then
    echo "❌ PROBLEM FOUND: Database is empty!"
    echo "   Solution: Run the update script to populate data"
    echo "   Command: docker exec vixsrc-addon xvfb-run --auto-servernum node scripts/nightly-update.js"
    exit 1
fi

# Check genre-specific data
echo "========================================="
echo "Genre Data Analysis"
echo "========================================="
AZIONE_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM movie_metadata WHERE genres LIKE '%Azione%';" 2>/dev/null || echo "0")
COMMEDIA_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM movie_metadata WHERE genres LIKE '%Commedia%';" 2>/dev/null || echo "0")
HORROR_COUNT=$(sqlite3 catalog.db "SELECT COUNT(*) FROM movie_metadata WHERE genres LIKE '%Horror%';" 2>/dev/null || echo "0")

echo "Azione (Action): $AZIONE_COUNT movies"
echo "Commedia (Comedy): $COMMEDIA_COUNT movies"
echo "Horror: $HORROR_COUNT movies"
echo ""

if [ "$AZIONE_COUNT" -eq 0 ]; then
    echo "⚠️  WARNING: No movies found with 'Azione' genre"
    echo "   This explains why genre=Azione catalog is empty"
fi

# Sample data check
echo "========================================="
echo "Sample Movie Records"
echo "========================================="
echo "First 3 movies with genres:"
sqlite3 catalog.db "SELECT tmdb_id, title, genres FROM movie_metadata WHERE genres IS NOT NULL AND genres != '' LIMIT 3;" 2>/dev/null || echo "No movies found"
echo ""

# Check cache files
echo "========================================="
echo "Cache Files Status"
echo "========================================="
for file in cache-*.json *-stremio.json; do
    if [ -f "$file" ]; then
        SIZE=$(du -h "$file" | cut -f1)
        MODIFIED=$(stat -c %y "$file" 2>/dev/null || stat -f "%Sm" "$file")
        echo "✅ $file ($SIZE) - Modified: $MODIFIED"
    fi
done
echo ""

# Check Docker container
echo "========================================="
echo "Docker Container Status"
echo "========================================="
if command -v docker &> /dev/null; then
    if docker ps | grep -q vixsrc-addon; then
        echo "✅ Container 'vixsrc-addon' is running"
        echo ""
        echo "Database path inside container:"
        docker exec vixsrc-addon ls -lh /app/catalog.db 2>/dev/null || echo "   Cannot access container"
        echo ""
        echo "Record count inside container:"
        docker exec vixsrc-addon sqlite3 /app/catalog.db "SELECT COUNT(*) FROM movie_metadata;" 2>/dev/null || echo "   Cannot query database"
    else
        echo "⚠️  Container 'vixsrc-addon' is not running"
        echo "   Start it with: docker-compose up -d"
    fi
else
    echo "⚠️  Docker not found or not accessible"
fi
echo ""

# Final summary
echo "========================================="
echo "Summary"
echo "========================================="
if [ "$MOVIE_COUNT" -gt 1000 ] && [ "$AZIONE_COUNT" -gt 0 ]; then
    echo "✅ Database appears healthy with $MOVIE_COUNT movies"
    echo "   If catalogs are still empty, check:"
    echo "   1. Container can access the database (permissions)"
    echo "   2. Environment variables in .env match expected paths"
    echo "   3. Catalog service logs for errors"
else
    echo "❌ Database needs attention:"
    if [ "$MOVIE_COUNT" -eq 0 ]; then
        echo "   - Database is empty, needs population"
    elif [ "$MOVIE_COUNT" -lt 1000 ]; then
        echo "   - Database has only $MOVIE_COUNT movies (expected 10,000+)"
    fi
    if [ "$AZIONE_COUNT" -eq 0 ]; then
        echo "   - Genre data is missing or incorrect"
    fi
    echo ""
    echo "   Recommended action: Run update script"
    echo "   docker exec vixsrc-addon xvfb-run --auto-servernum node scripts/nightly-update.js"
fi
