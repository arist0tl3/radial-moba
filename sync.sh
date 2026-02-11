#!/bin/bash
# Syncs shared files from server to client
# Run from project root: ./sync.sh

SHARED_SRC="server/src/shared"
SHARED_DST="client/src/shared"

mkdir -p "$SHARED_DST"
cp -r "$SHARED_SRC/"* "$SHARED_DST/"

echo "Synced shared files from $SHARED_SRC → $SHARED_DST"
