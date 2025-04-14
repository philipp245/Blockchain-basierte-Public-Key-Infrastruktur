// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Deployed die 5 Smart Contracts auf dem Sepolia-Testnet.

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy LoggingManager
  const LoggingManager = await hre.ethers.getContractFactory("LoggingManager");
  const loggingManager = await LoggingManager.deploy();
  await loggingManager.waitForDeployment(); 
  console.log("LoggingManager deployed to:", loggingManager.target); 

  // 2. Deploy StakeManager
  const StakeManager = await hre.ethers.getContractFactory("StakeManager");
  const stakeManager = await StakeManager.deploy(loggingManager.target);
  await stakeManager.waitForDeployment();
  console.log("StakeManager deployed to:", stakeManager.target);

  // 3. Deploy TrustManager
  const TrustManager = await hre.ethers.getContractFactory("TrustManager");
  const trustManager = await TrustManager.deploy(loggingManager.target);
  await trustManager.waitForDeployment();
  console.log("TrustManager deployed to:", trustManager.target);

  // 4. Deploy ConsensusManager
  const ConsensusManager = await hre.ethers.getContractFactory("ConsensusManager");
  const consensusManager = await ConsensusManager.deploy(stakeManager.target, loggingManager.target);
  await consensusManager.waitForDeployment();
  console.log("ConsensusManager deployed to:", consensusManager.target);

  // 5. Set ConsensusManager in StakeManager
  await stakeManager.setConsensusManager(consensusManager.target);
  console.log("ConsensusManager set in StakeManager");

  // 6. Deploy CertificateCore
  const CertificateCore = await hre.ethers.getContractFactory("CertificateCore");
  const certificateCore = await CertificateCore.deploy(trustManager.target, stakeManager.target, loggingManager.target);
  await certificateCore.waitForDeployment();
  console.log("CertificateCore deployed to:", certificateCore.target);

  console.log("Deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
