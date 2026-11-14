#!/usr/bin/env bash
# Runs the Par test suite against the REAL MUSD contracts by dropping Par into a clone of
# github.com/mezo-org/musd/solidity (which deploys the full MUSD system + MockAggregator).
#
#   ./scripts/run-musd-integration.sh            # clones into contracts/.musd
#   MUSD_DIR=/path/to/musd ./scripts/run-musd-integration.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MUSD_DIR="${MUSD_DIR:-$ROOT/.musd}"

if [ ! -d "$MUSD_DIR/solidity" ]; then
  git clone --depth 1 https://github.com/mezo-org/musd "$MUSD_DIR"
fi
cd "$MUSD_DIR/solidity"
[ -d node_modules ] || pnpm install

mkdir -p contracts/par/interfaces test/par
cp "$ROOT"/contracts/ParVault.sol "$ROOT"/contracts/ParFactory.sol "$ROOT"/contracts/ParCircuit.sol contracts/par/
cp "$ROOT"/contracts/interfaces/IMezo.sol contracts/par/interfaces/
cp "$ROOT"/test/Par.test.ts test/par/Par.test.ts
cp "$ROOT"/integration/helpers.ts test/par/helpers.ts
cp -n .env.example .env 2>/dev/null || true

npx hardhat test test/par/Par.test.ts 2>&1 | tee "$ROOT/integration/last-run.txt"
