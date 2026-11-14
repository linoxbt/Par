// Source: @mezo-org/musd-contracts@1.1.0 deployments/{matsnet,mainnet}. These are proxies;
// confirm on the explorer before mainnet.
export const MUSD_ADDRESSES = {
  matsnet: {
    chainId: 31611,
    BorrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
    TroveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
    PriceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
    MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
    HintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
    SortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
    InterestRateManager: "0xD4D6c36A592A2c5e86035A6bca1d57747a567f37",
  },
  mezo: {
    chainId: 31612,
    BorrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
    TroveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
    PriceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
    MUSD: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
    HintHelpers: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3",
    SortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
    InterestRateManager: "0x4a453700d157717Fe02fB62E7700ED7845048285",
  },
} as const

export const STRESS_BPS = 4000n // commitments survive a 40% BTC drop
export const TARGET_ICR = 1_600_000_000_000_000_000n // ...and the vault stays >= 160%
