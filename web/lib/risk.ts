import { CCR, GAS_COMP, MCR } from "./config"

const E18 = 10n ** 18n
const BPS = 10_000n

/** 0.1% borrowing fee (spec 3.3; the UI reads getBorrowingFee where it matters). */
export const fee = (x: bigint) => x / 1000n

/**
 * Preview for opening a vault (spec 5.6): with `coll` BTC at `price` and a `seed` draw,
 * what capacity is snapshotted and how much cover fits the stress test?
 */
export function openPreview(coll: bigint, price: bigint, seed: bigint, stressBps: bigint, targetIcr: bigint) {
  const debt = seed + fee(seed) + GAS_COMP
  const value = (coll * price) / E18
  const capacity = (coll * price) / MCR
  const stressed = (price * (BPS - stressBps)) / BPS
  const maxDebtStressed = (((coll * stressed) / E18) * E18) / targetIcr
  const roomStress = maxDebtStressed > debt ? ((maxDebtStressed - debt) * 1000n) / 1001n : 0n
  const roomCap = capacity > debt ? ((capacity - debt) * 1000n) / 1001n : 0n
  const maxCover = roomStress < roomCap ? roomStress : roomCap
  const icr = (coll * price) / debt
  return { debt, value, capacity, maxCover, payable: maxCover + seed, icr }
}

/**
 * "Still covered if BTC falls X%" (spec 5.6): worst case every reserved commitment is called;
 * the price at which ICR hits 150% (CCR) after all draws. Returns a fraction 0..1.
 */
export function maxDrop(coll: bigint, debt: bigint, reserved: bigint, price: bigint) {
  if (coll === 0n || price === 0n) return 0
  const need = reserved + fee(reserved)
  const num = CCR * (debt + need)
  const den = coll * price
  const ratio = Number((num * 1_000_000n) / den) / 1_000_000
  return Math.max(0, 1 - ratio)
}

/** Price at which ICR falls to MCR (liquidation) after every reserved commitment is drawn. */
export function liquidationPrice(coll: bigint, debt: bigint, reserved: bigint) {
  if (coll === 0n) return 0n
  const need = reserved + fee(reserved)
  return (MCR * (debt + need)) / coll
}
