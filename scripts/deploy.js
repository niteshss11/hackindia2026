const hre = require("hardhat");

async function main() {
  const Healthcare = await hre.ethers.getContractFactory("Healthcare");
  const healthcare = await Healthcare.deploy();

  await healthcare.deployed();

  console.log(`Contract Address: ${healthcare.address}`);
  console.log(`NEXT_PUBLIC_HEALTH_CARE=${healthcare.address}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${healthcare.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
