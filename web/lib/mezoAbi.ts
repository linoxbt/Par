import { parseAbi } from "viem"

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
])

export const priceFeedAbi = parseAbi(["function fetchPrice() view returns (uint256)"])

export const troveManagerAbi = parseAbi([
  "function getTroveInterestRate(address) view returns (uint16)",
  "function getTroveMaxBorrowingCapacity(address) view returns (uint256)",
  "function getTroveStatus(address) view returns (uint8)",
  "function getTCR(uint256) view returns (uint256)",
  "function checkRecoveryMode(uint256) view returns (bool)",
])

export const borrowerOpsAbi = parseAbi([
  "function minNetDebt() view returns (uint256)",
  "function getBorrowingFee(uint256) view returns (uint256)",
])

export const interestRateManagerAbi = parseAbi(["function interestRate() view returns (uint16)"])
