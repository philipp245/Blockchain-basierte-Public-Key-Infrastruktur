// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Testsuite für die Interaktion mit deployten Smart Contracts auf dem Sepolia-Testnet.
//               Testet die Autorisierung von Entitäten im LoggingManager
//               sowie das Hinzufügen einer neuen Certificate Authority (CA) im TrustManager.

const hre = require("hardhat");

// Haupttestfunktion, die die Interaktion mit den Smart Contracts steuert
async function main() {
  // Abruf der Signer: Deployer (Hauptaccount) und Chrome-Account (Test-CA)
  const [deployer, chromeAccount] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer.address); // Ausgabe der Deployer-Adresse (0x3fd62FD4...)
  console.log("Chrome account:", chromeAccount.address); // Ausgabe der Chrome-Account-Adresse (0x03287bb...)

  // Festgelegte Adressen der deployten Contracts auf Sepolia
  const loggingManagerAddr = "0x9873638f6533625e221ddF1F79b2F7B643d0570a";
  const stakeManagerAddr = "0x0A43b809737e85f6fb8980600968b539a0a5d766";
  const trustManagerAddr = "0x6DDc5386e42664A58c3d1903Bafbdd1d0F77733d";
  const consensusManagerAddr = "0xCD0A1eB3068E518D7A9E1C92fA60F6504613bc29";
  const certificateCoreAddr = "0x17A34b12C1C0df0809C2d927459Bfd2683BBC035";

  // Initialisierung der Contract-Instanzen mit ihren deployten Adressen
  const LoggingManager = await hre.ethers.getContractFactory("LoggingManager");
  const loggingManager = LoggingManager.attach(loggingManagerAddr);

  const TrustManager = await hre.ethers.getContractFactory("TrustManager");
  const trustManager = TrustManager.attach(trustManagerAddr);

  // Test 1: Überprüfung, ob der Deployer als CA im TrustManager registriert ist
  const isDeployerCA = await trustManager.isCA(deployer.address);
  console.log("Is Deployer a CA?", isDeployerCA); // Erwartet: true, da Deployer initial CA ist

  // Debugging: Überprüfung, ob der Deployer im LoggingManager autorisiert ist
  const isDeployerAuthorized = await loggingManager.isAuthorized(deployer.address);
  console.log("Is Deployer authorized in LoggingManager?", isDeployerAuthorized); // Erwartet: true

  // Bedingte Autorisierung des TrustManager im LoggingManager
  if (!await loggingManager.isAuthorized(trustManagerAddr)) {
    console.log("Authorizing TrustManager in LoggingManager...");
    // Autorisierung des TrustManager durch den Deployer
    const tx = await loggingManager.connect(deployer).addAuthorized(trustManagerAddr);
    await tx.wait(); // Warten auf Transaktionsbestätigung
    const isTrustManagerAuthorized = await loggingManager.isAuthorized(trustManagerAddr);
    console.log("Is TrustManager authorized after tx?", isTrustManagerAuthorized); // Erwartet: true
  } else {
    console.log("TrustManager is already authorized."); // Falls bereits autorisiert
  }

  // Test 2: Hinzufügen des Chrome-Accounts als neue CA im TrustManager
  console.log("Adding Chrome account as new CA...");
  const txAddCA = await trustManager.connect(deployer).addCA(chromeAccount.address);
  await txAddCA.wait(); // Warten auf Transaktionsbestätigung
  const isChromeCA = await trustManager.isCA(chromeAccount.address);
  console.log("Is Chrome account a CA?", isChromeCA); // Erwartet: true

  console.log("Tests completed up to CA addition!"); // Abschlussmeldung
}

// Ausführung der Hauptfunktion mit Fehlerbehandlung
main()
  .then(() => process.exit(0)) // Erfolgreicher Abschluss
  .catch((error) => {
    console.error(error); // Fehlerausgabe
    process.exit(1); // Abbruch bei Fehler
  });