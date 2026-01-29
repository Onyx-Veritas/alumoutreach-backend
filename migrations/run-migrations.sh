#!/bin/bash
# ============================================================
# DEPRECATED: Host-based Migration Runner
# ============================================================
# This script is DEPRECATED. Do not use.
#
# Migrations now run inside Docker:
#   docker compose -f docker-compose.dev.yml run --rm migrations
#
# This file is kept for reference only and will be removed
# in a future version.
# ============================================================

echo "⚠️  DEPRECATED: This script is no longer supported."
echo ""
echo "Migrations now run inside Docker. Use:"
echo ""
echo "  docker compose -f docker-compose.dev.yml run --rm migrations"
echo ""
exit 1
