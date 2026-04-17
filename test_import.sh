set -e
SERVER="http://127.0.0.1:8000"

# 1) Get auth token
TOKEN=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin", "password":"admin12345"}' | grep -oP '"access_token":"\K[^"]+')

echo "Auth Token: ${TOKEN:0:10}..."

# 2) Import inventory
echo "Importing inventory..."
IMPORT_INV=$(curl -s -X POST "$SERVER/api/import/inventory-csv" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample-import/inventory.csv")
echo "Inventory response: $IMPORT_INV"

# 3) Import layout
echo "Importing layout..."
IMPORT_LAY=$(curl -s -X POST "$SERVER/api/import/layout-csv" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample-import/layout.csv")
echo "Layout response: $IMPORT_LAY"

# 4) Fetch floorplans and verify imported serials + mount_side
echo "Fetching floorplans..."
FLOORPLAN=$(curl -s -X GET "$SERVER/api/floorplans?serverroom_id=1" \
  -H "Authorization: Bearer $TOKEN")

echo "Verifying A02..."
RACK_A02=$(echo "$FLOORPLAN" | jq -c '.[]?.racks[]? | select(.name == "A02")')

if [ -z "$RACK_A02" ]; then
    echo "ERROR: Rack A02 not found in floorplan."
    exit 1
fi

echo "Rack A02 Details: $RACK_A02"

EXPECTED='{"CS9300-0001":"back","PE670-0001":"front","DL380-0001":"front"}'

MISSING=()
WRONG_SIDE=()

for S in CS9300-0001 PE670-0001 DL380-0001; do
  FOUND=$(echo "$RACK_A02" | jq -r --arg sn "$S" '.devices[]? | select(.serial_number == $sn) | .serial_number')
  SIDE=$(echo "$RACK_A02" | jq -r --arg sn "$S" '.devices[]? | select(.serial_number == $sn) | .mount_side')
  EXPECTED_SIDE=$(echo "$EXPECTED" | jq -r --arg sn "$S" '.[$sn]')

  if [ -z "$FOUND" ]; then
    MISSING+=("$S")
    continue
  fi

  if [ "$SIDE" != "$EXPECTED_SIDE" ]; then
    WRONG_SIDE+=("$S:$SIDE(expected $EXPECTED_SIDE)")
  fi
done

if [ ${#MISSING[@]} -eq 0 ] && [ ${#WRONG_SIDE[@]} -eq 0 ]; then
  echo "VERIFICATION: SUCCESS - Serials found in A02 with expected mount_side values"
else
  if [ ${#MISSING[@]} -gt 0 ]; then
    echo "VERIFICATION: FAILED - Missing serials: ${MISSING[*]}"
  fi
  if [ ${#WRONG_SIDE[@]} -gt 0 ]; then
    echo "VERIFICATION: FAILED - Wrong mount_side: ${WRONG_SIDE[*]}"
  fi
  exit 1
fi
