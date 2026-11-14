// Tops up the three Circuit demo shops (signers #1..#3) from the deployer (signer #0).
//   DEMO_FUND=0.13 npx hardhat run scripts/fund-demo.ts --network matsnet
import { ethers } from "hardhat"

async function main() {
  const [admin, ...shops] = await ethers.getSigners()
  if (shops.length < 3) throw new Error("set MATSNET_DEMO_KEYS (three keys)")
  const target = ethers.parseEther(process.env.DEMO_FUND || "0.13")
  for (const s of shops.slice(0, 3)) {
    const bal = await ethers.provider.getBalance(s.address)
    if (bal >= target) {
      console.log(s.address, "already has", ethers.formatEther(bal))
      continue
    }
    const tx = await admin.sendTransaction({ to: s.address, value: target - bal })
    await tx.wait()
    console.log(s.address, "funded to", ethers.formatEther(target), tx.hash)
  }
  console.log("admin left", ethers.formatEther(await ethers.provider.getBalance(admin.address)))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
