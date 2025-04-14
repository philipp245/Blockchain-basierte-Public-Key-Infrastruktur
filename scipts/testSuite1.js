// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Manuelles Test-Skript für die Smart Contracts einer Blockchain-basierten
//               Public Key Infrastructure (PKI) auf dem Sepolia-Testnet.
//               Testet Funktionen wie Node-Registrierung, Konsensabstimmungen, Zertifikatsausstellung
//               und Vertrauensmanagement mit einfacher Schritt-für-Schritt-Logik.

const hre = require("hardhat");

async function main() {
  // Abruf der Signer (werden aus hardhat.congig.js geladen. Hierbei handelt es ich um die Priave keys.)
  const [deployer, chromeAccount] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer.address);
  console.log("Chrome account:", chromeAccount.address);

  // Deployte Contract-Adressen (müssen nach neuem Deployen ausgetauscht werden)
  const loggingManagerAddr = "0x9873638f6533625e221ddF1F79b2F7B643d0570a";
  const stakeManagerAddr = "0x0A43b809737e85f6fb8980600968b539a0a5d766";
  const trustManagerAddr = "0x6DDc5386e42664A58c3d1903Bafbdd1d0F77733d";
  const consensusManagerAddr = "0xCD0A1eB3068E518D7A9E1C92fA60F6504613bc29";
  const certificateCoreAddr = "0x17A34b12C1C0df0809C2d927459Bfd2683BBC035";

  // Contract-Instanzen erstellen
  const LoggingManager = await hre.ethers.getContractFactory("LoggingManager");
  const loggingManager = LoggingManager.attach(loggingManagerAddr);

  const StakeManager = await hre.ethers.getContractFactory("StakeManager");
  const stakeManager = StakeManager.attach(stakeManagerAddr);

  const TrustManager = await hre.ethers.getContractFactory("TrustManager");
  const trustManager = TrustManager.attach(trustManagerAddr);

  const ConsensusManager = await hre.ethers.getContractFactory("ConsensusManager");
  const consensusManager = ConsensusManager.attach(consensusManagerAddr);

  const CertificateCore = await hre.ethers.getContractFactory("CertificateCore");
  const certificateCore = CertificateCore.attach(certificateCoreAddr);

  // Autorisierung aller Contracts im LoggingManager
  console.log("Authorizing contracts in LoggingManager...");
  for (const addr of [stakeManagerAddr, trustManagerAddr, consensusManagerAddr, certificateCoreAddr]) {
    if (!await loggingManager.isAuthorized(addr)) {
      const tx = await loggingManager.connect(deployer).addAuthorized(addr);
      await tx.wait();
      console.log(`Authorized ${addr}`);
    } else {
      console.log(`${addr} already authorized`);
    }
  }

  // Test 1: Node-Registrierung
  console.log("\nTest 1: Registering a node in StakeManager...");
  const publicKeyNode = "0x1234";
  const isNode = await stakeManager.isRegisteredNode(deployer.address);
  if (!isNode) {
    const tx = await stakeManager.connect(deployer).registerNode(publicKeyNode, { value: hre.ethers.parseEther("0.001") });
    await tx.wait();
    console.log("Node registered successfully");
  } else {
    console.log("Deployer is already a registered node");
  }
  console.log("Is Deployer a node?", await stakeManager.isRegisteredNode(deployer.address));

  // Test 2: Konsensabstimmung
  console.log("\nTest 2: Creating and voting on a consensus proposal...");
  const actionHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TestAction" + Date.now())); // Eindeutiger Hash
  const txCreateVote = await consensusManager.connect(deployer).createConsensusVote(actionHash);
  await txCreateVote.wait();
  const voteId = (await consensusManager.voteCounter()) - 1n;
  console.log("Created vote with ID:", voteId.toString());
  const txVote = await consensusManager.connect(deployer).voteOnConsensus(voteId, true);
  await txVote.wait();
  const vote = await consensusManager.consensusVotes(voteId);
  console.log("StakeFor:", vote.stakeFor.toString(), "StakeAgainst:", vote.stakeAgainst.toString());
  console.log("Vote result:", await consensusManager.getVoteResult(voteId));

  // Test 3: Zertifikatsausstellung
  console.log("\nTest 3: Issuing a certificate...");
  const subject = chromeAccount.address;
  const publicKeyCert = "0x5678";
  const currentTime = Number(await trustManager.getCurrentTime());
  const validFrom = currentTime - 3600; // Vor 1 Stunde
  const validTo = currentTime + 86400;  // Bis 24 Stunden später
  const algorithm = 0;
  const txIssue = await certificateCore.connect(deployer).issueCertificate(subject, publicKeyCert, validFrom, validTo, algorithm);
  await txIssue.wait();
  const certHash = hre.ethers.keccak256(
    hre.ethers.solidityPacked(
      ["address", "address", "bytes", "uint256", "uint256", "uint8"],
      [deployer.address, subject, publicKeyCert, validFrom, validTo, algorithm]
    )
  );
  const cert = await certificateCore.certificates(certHash);
  console.log("Certificate issuer:", cert.issuer, "validFrom:", cert.validFrom.toString(), "validTo:", cert.validTo.toString());
  console.log("Is certificate valid?", await certificateCore.isCertificateValid(certHash));

  // Test 4: Zertifikatswiderruf
  console.log("\nTest 4: Revoking a certificate...");
  const publicKeyCert2 = "0x9012";
  const txIssue2 = await certificateCore.connect(deployer).issueCertificate(subject, publicKeyCert2, validFrom, validTo, algorithm);
  await txIssue2.wait();
  const certHash2 = hre.ethers.keccak256(
    hre.ethers.solidityPacked(
      ["address", "address", "bytes", "uint256", "uint256", "uint8"],
      [deployer.address, subject, publicKeyCert2, validFrom, validTo, algorithm]
    )
  );
  const txRevoke = await certificateCore.connect(deployer).revokeCertificate(certHash2);
  await txRevoke.wait();
  console.log("Is certificate revoked?", await certificateCore.isRevoked(certHash2));

  // Test 5: Vertrauensdelegierung
  console.log("\nTest 5: Delegating trust...");
  const isTrustedBefore = await trustManager.isTrusted(chromeAccount.address);
  if (!isTrustedBefore) {
    const txDelegate = await trustManager.connect(deployer).delegateTrust(chromeAccount.address);
    await txDelegate.wait();
    console.log("Trust delegated successfully");
  } else {
    console.log("Chrome account already trusted");
  }
  console.log("Is Chrome account trusted?", await trustManager.isTrusted(chromeAccount.address));

  console.log("\nAll tests completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
