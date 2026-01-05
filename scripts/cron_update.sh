#!/bin/bash

# VixSrc Addon - Nightly Update Script
# This runs inside the Docker container using a fresh Xvfb display

# Navigate to directory if needed (optional, depends on setup)
# cd /opt/vixsrc-catalogs

# Execute the update
# We use xvfb-run to ensure Puppeteer can launch a headful browser
docker exec vixsrc-addon xvfb-run --auto-servernum --server-args="-screen 0 1280x800x24" node scripts/nightly-update.js >> ./cron_update.log 2>&1
