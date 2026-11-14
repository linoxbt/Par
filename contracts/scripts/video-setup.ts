// Demo-video chain prep (with hardhat.video.config.ts): canonical Multicall3 and a realistic BTC price. Run after deploy-local.
import fs from "fs"
import { ethers, network } from "hardhat"
async function main() {
  const dep = JSON.parse(fs.readFileSync("deployments/localhost.json", "utf8"))
  const mc = await (await ethers.getContractFactory("Multicall3")).deploy()
  const code = await ethers.provider.getCode(await mc.getAddress())
  await network.provider.send("hardhat_setCode", ["0xcA11bde05977b3631167028862bE2a173976CA11", code])
  const pf = await ethers.getContractAt("MockPriceFeed", dep.priceFeed ?? dep.musd?.PriceFeed ?? dep.PriceFeed)
  await (await pf.setPrice(ethers.parseEther("65500"))).wait()
  console.log("multicall3 set; price", ethers.formatEther(await pf.price()))
}
main()
