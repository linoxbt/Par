#!/usr/bin/env bash
# One-command local demo: hardhat node + mock MUSD system + Par + seeded demo data + keeper + web.
#   ./scripts/dev-local.sh
# Then open http://localhost:3000. Connect MetaMask to http://127.0.0.1:8545 (chain 31337) and import a
# hardhat test key (account #1..#3 are the Circuit shops, #0 owns the guarantee demo vault).
# Time travel (local only):  curl -s -X POST localhost:8545 -H 'content-type: application/json' \
#   -d '{"jsonrpc":"2.0","id":1,"method":"evm_increaseTime","params":[300]}'
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/.dev-logs"
mkdir -p "$LOG"

(cd "$ROOT/contracts" && { [ -d node_modules ] || npm install; })
(cd "$ROOT/keeper" && { [ -d node_modules ] || npm install; })
(cd "$ROOT/web" && { [ -d node_modules ] || npm install --legacy-peer-deps; })

cleanup() { kill $(jobs -p) 2>/dev/null || true; }
trap cleanup EXIT

echo "starting hardhat node…"
(cd "$ROOT/contracts" && npx hardhat node > "$LOG/node.log" 2>&1) &
until curl -s -X POST localhost:8545 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' >/dev/null 2>&1; do sleep 1; done

cd "$ROOT/contracts"
npx hardhat run scripts/deploy-local.ts --network localhost > "$LOG/deploy.log"
npx hardhat run scripts/seed-demo.ts --network localhost | tee "$LOG/seed-demo.log"
npx hardhat run scripts/seed-guarantee.ts --network localhost | tee "$LOG/seed-guarantee.log"

D="$ROOT/contracts/deployments/localhost.json"
FACTORY=$(node -p "require('$D').ParFactory")
CIRCUIT=$(node -p "require('$D').ParCircuit")
cat > "$ROOT/web/.env.local" <<ENV
NEXT_PUBLIC_CHAIN=local
NEXT_PUBLIC_FACTORY=$FACTORY
NEXT_PUBLIC_CIRCUIT=$CIRCUIT
NEXT_PUBLIC_FACTORY_BLOCK=0
ENV

echo "starting keeper (hardhat account #9)…"
(cd "$ROOT/keeper" && CHAIN=local RPC_URL=http://127.0.0.1:8545 \
  KEEPER_KEY=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 \
  FACTORY=$FACTORY CIRCUIT=$CIRCUIT INTERVAL_MS=5000 npx tsx src/index.ts > "$LOG/keeper.log" 2>&1) &

echo "starting web on http://localhost:3000 …"
cd "$ROOT/web" && npx next dev -p 3000
