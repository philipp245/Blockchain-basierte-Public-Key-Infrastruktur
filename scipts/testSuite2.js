// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Manuelles Test-Skript für die Smart Contracts einer Blockchain-basierten
//               Public Key Infrastructure (PKI) auf dem Sepolia-Testnet.
//               Testet Interaktionen zwischen mehreren Wallets (Deployer, Chrome, Edge), einschließlich
//               Node-Registrierung, Konsensabstimmungen, Zertifikatsausstellung, Fehlerfälle und Co-Signing,
//               mit einfacher Schritt-für-Schritt-Logik zur Validierung der Systemfunktionalität.

const hre = require("hardhat");

async function main() {
  // ### Initialisierung der Wallets und Verträge ###

  // Abruf der Signer für Deployer, Chrome und Edge Wallets
  const [deployer, chromeAccount, edgeAccount] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer.address);
  console.log("Chrome account:", chromeAccount.address);
  console.log("Edge account:", edgeAccount.address);

  // Adressen der deployten Smart Contracts auf Sepolia
  const loggingManagerAddr = "0x9873638f6533625e221ddF1F79b2F7B643d0570a";
  const stakeManagerAddr = "0x0A43b809737e85f6fb8980600968b539a0a5d766";
  const trustManagerAddr = "0x6DDc5386e42664A58c3d1903Bafbdd1d0F77733d";
  const consensusManagerAddr = "0xCD0A1eB3068E518D7A9E1C92fA60F6504613bc29";
  const certificateCoreAddr = "0x17A34b12C1C0df0809C2d927459Bfd2683BBC035";

  // Initialisierung der Contract-Instanzen
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

  // ### Autorisierung der Verträge ###
  console.log("Authorizing contracts in LoggingManager...");
  for (const addr of [stakeManagerAddr, trustManagerAddr, consensusManagerAddr, certificateCoreAddr]) {
    if (!await loggingManager.isAuthorized(addr)) {
      const tx = await loggingManager.connect(deployer).addAuthorized(addr, { gasLimit: 100000 });
      await tx.wait();
      console.log(`Authorized ${addr}`);
    } else {
      console.log(`${addr} already authorized`);
    }
  }

  // ### Testfälle ###

  // **Test 1: Node-Registrierung**
  // Ziel: Prüft, ob jede Wallet sich als Node registrieren kann
  console.log("\nTest 1: Registering nodes in StakeManager...");
  const publicKeyNode = "0x1234";
  for (const account of [deployer, chromeAccount, edgeAccount]) {
    const isNode = await stakeManager.isRegisteredNode(account.address);
    if (!isNode) {
      const tx = await stakeManager.connect(account).registerNode(publicKeyNode, { value: hre.ethers.parseEther("0.01"), gasLimit: 200000 });
      await tx.wait();
      console.log(`${account.address} node registered successfully`);
    } else {
      console.log(`${account.address} is already a registered node`);
    }
    console.log(`Is ${account.address} a node?`, await stakeManager.isRegisteredNode(account.address));
  }

  // **Test 2: Konsensabstimmung**
  // Ziel: Testet die Erstellung eines Vorschlags und die Abstimmung durch alle Wallets
  console.log("\nTest 2: Creating and voting on a consensus proposal...");
    const actionHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TestAction" + Date.now()));
    const txCreateVote = await consensusManager.connect(deployer).createConsensusVote(actionHash, { gasLimit: 200000 });
    await txCreateVote.wait();
    const voteId = (await consensusManager.voteCounter()) - 1n;
    console.log("Created vote with ID:", voteId.toString());

    // Abstimmung durch die Nodes mit await tx.wait()
    const txDeployerVote = await consensusManager.connect(deployer).voteOnConsensus(voteId, true, { gasLimit: 200000 });
    await txDeployerVote.wait();
    const txChromeVote = await consensusManager.connect(chromeAccount).voteOnConsensus(voteId, false, { gasLimit: 200000 });
    await txChromeVote.wait();
    const txEdgeVote = await consensusManager.connect(edgeAccount).voteOnConsensus(voteId, true, { gasLimit: 200000 });
    await txEdgeVote.wait();

    // Ergebnisse der Abstimmung
    const vote = await consensusManager.consensusVotes(voteId);
    console.log("StakeFor:", vote.stakeFor.toString(), "StakeAgainst:", vote.stakeAgainst.toString());
    console.log("Vote result:", await consensusManager.getVoteResult(voteId));

  // **Test 3: Zertifikatsausstellung**
  // Ziel: Prüft, ob Deployer ein Zertifikat für Edge ausstellen kann
  console.log("\nTest 3: Issuing certificates...");
  const timestamp = Date.now().toString(16);
  const paddedTimestamp = timestamp.length % 2 === 0 ? timestamp : "0" + timestamp;
  const publicKeyCert = "0x5678" + paddedTimestamp;
  const currentTime = Number(await trustManager.getCurrentTime());
  const validFrom = currentTime - 3600;
  const validTo = currentTime + 86400;
  const algorithm = 0;

  const txIssueDeployer = await certificateCore.connect(deployer).issueCertificate(
    edgeAccount.address,
    publicKeyCert,
    validFrom,
    validTo,
    algorithm,
    { gasLimit: 500000 }
  );
  await txIssueDeployer.wait();
  const certHashDeployer = hre.ethers.keccak256(
    hre.ethers.solidityPacked(
      ["address", "address", "bytes", "uint256", "uint256", "uint8"],
      [deployer.address, edgeAccount.address, publicKeyCert, validFrom, validTo, algorithm]
    )
  );
  console.log("Certificate issued by Deployer for Edge, valid?", await certificateCore.isCertificateValid(certHashDeployer));

  // **Test 4: Fehlerfall - Unbefugter Zugriff**
  // Ziel: Prüft, ob Edge (keine CA) kein Zertifikat ausstellen kann
  console.log("\nTest 4: Unauthorized access to issueCertificate by Edge...");
  try {
    const tx = await certificateCore.connect(edgeAccount).issueCertificate(deployer.address, publicKeyCert, validFrom, validTo, algorithm, { gasLimit: 500000 });
    await tx.wait();
    console.log("Error: Unauthorized access succeeded!");
  } catch (error) {
    console.log("Success: Unauthorized access rejected as expected.");
  }

  // **Test 5: Fehlerfall - Ungültiges Zertifikat**
  // Ziel: Prüft, ob Zertifikate mit ungültigen Zeitstempeln abgelehnt werden
  console.log("\nTest 5: Issuing a certificate with invalid timestamps...");
  const invalidFrom = validTo;
  const invalidTo = validFrom - 86400;
  try {
    const tx = await certificateCore.connect(deployer).issueCertificate(chromeAccount.address, publicKeyCert, invalidFrom, invalidTo, algorithm, { gasLimit: 500000 });
    await tx.wait();
    console.log("Error: Invalid timestamp succeeded!");
  } catch (error) {
    console.log("Success: Invalid timestamp rejected as expected.");
  }

  // **Test 6: Co-Signing**
  // Ziel: Prüft, ob Chrome ein Zertifikat mitunterzeichnen kann
  console.log("\nTest 6: Co-signing a certificate by Chrome...");
    if (!(await trustManager.isCA(chromeAccount.address))) {
    const txAddCA = await trustManager.connect(deployer).addCA(chromeAccount.address, { gasLimit: 200000 });
    await txAddCA.wait();
    console.log("Added Chrome as CA");
    }
    const txCosign = await certificateCore.connect(chromeAccount).coSignCertificate(certHashDeployer, { gasLimit: 200000 });
    await txCosign.wait();
    const cosigners = await certificateCore.getCosigners(certHashDeployer);
    console.log("Cosigners for Deployer's certificate:", cosigners);
}

// ### Ausführung der Hauptfunktion ###
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });