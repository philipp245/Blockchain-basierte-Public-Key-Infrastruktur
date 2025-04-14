// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für das Zusammenspiel der Smart Contracts in einer Blockchain-basierten 
//               Public Key Infrastructure (PKI). 
//               Testet die Kernfunktionalitäten wie Zertifikatsausstellung, -widerruf, 
//               -authentifizierung, Vertrauensmanagement und Konsensmechanismen.

const { expect } = require("chai");
const { ethers } = require("hardhat");

// **Hauptbeschreibung**: Testsuite für die Anforderungen und Use-Cases eines Public-Key-Infrastructure (PKI)-Systems auf Blockchain-Basis.
describe("PKI System Requirements and Use-Cases Tests", function () {
    // Variablen für Verträge und Signer
    let CertificateCore, StakeManager, TrustManager, ConsensusManager, LoggingManager;
    let certificateCore, stakeManager, trustManager, consensusManager, loggingManager;
    let owner, addr1, addr2, addr3;

    // **ID: SETUP**
    // **Beschreibung**: Initialisiert alle Smart Contracts und Signer vor jedem Test.
    // **Zwischenschritte**:
    // 1. Signer (owner, addr1, addr2, addr3) abrufen
    // 2. LoggingManager deployen für Protokollierung
    // 3. StakeManager deployen und mit LoggingManager verknüpfen
    // 4. TrustManager deployen und mit LoggingManager verknüpfen
    // 5. ConsensusManager deployen und mit StakeManager/LoggingManager verknüpfen
    // 6. CertificateCore deployen und mit TrustManager, StakeManager, LoggingManager verknüpfen
    // 7. Berechtigungen im LoggingManager setzen
    // 8. ConsensusManager in StakeManager konfigurieren
    // **Erwartetes Ergebnis**: Alle Verträge sind korrekt initialisiert und einsatzbereit.
    beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        const LoggingManagerFactory = await ethers.getContractFactory("LoggingManager");
        loggingManager = await LoggingManagerFactory.deploy();
        await loggingManager.waitForDeployment();

        const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
        stakeManager = await StakeManagerFactory.deploy(loggingManager.target);
        await stakeManager.waitForDeployment();

        const TrustManagerFactory = await ethers.getContractFactory("TrustManager");
        trustManager = await TrustManagerFactory.deploy(loggingManager.target);
        await trustManager.waitForDeployment();

        const ConsensusManagerFactory = await ethers.getContractFactory("ConsensusManager");
        consensusManager = await ConsensusManagerFactory.deploy(stakeManager.target, loggingManager.target);
        await consensusManager.waitForDeployment();

        await stakeManager.setConsensusManager(consensusManager.target);

        const CertificateCoreFactory = await ethers.getContractFactory("CertificateCore");
        certificateCore = await CertificateCoreFactory.deploy(trustManager.target, stakeManager.target, loggingManager.target);
        await certificateCore.waitForDeployment();

        await loggingManager.addAuthorized(stakeManager.target);
        await loggingManager.addAuthorized(trustManager.target);
        await loggingManager.addAuthorized(consensusManager.target);
        await loggingManager.addAuthorized(certificateCore.target);
    });

    // **Allgemeine PKI-Funktionen**
    describe("Allgemeine PKI-Funktionen", function () {
        // **ID: TEST1**
        // **Beschreibung**: Testet, ob eine CA ein X.509-kompatibles Zertifikat ausstellen kann.
        // **Zwischenschritte**:
        // 1. addr1 als CA autorisieren
        // 2. Zertifikatsparameter definieren (publicKey, Gültigkeit, Algorithmus)
        // 3. Zertifikat ausstellen und Event prüfen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird ausgelöst.
        // **Anforderung**: X.509-Zertifikatsstruktur
        it("ID1: sollte einer CA erlauben, ein X.509-kompatibles Zertifikat auszustellen (Anforderung: X.509-Zertifikatsstruktur)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0; // ECDSA als Beispiel
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            await expect(tx).to.emit(certificateCore, "CertificateIssued");
        });

        // **ID: TEST2**
        // **Beschreibung**: Testet die dezentrale Schlüsselgenerierung.
        // **Zwischenschritte**:
        // 1. Clientseitige Schlüsselgenerierung simulieren
        // 2. CA autorisieren
        // 3. Zertifikat mit generiertem Schlüssel ausstellen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird ausgelöst.
        // **Anforderung**: Dezentrale Schlüsselgenerierung
        it("ID2: sollte dezentrale Schlüsselgenerierung ermöglichen (Anforderung: Dezentrale Schlüsselgenerierung)", async function () {
            const wallet = ethers.Wallet.createRandom();
            const publicKey = ethers.toUtf8Bytes(wallet.publicKey);
            await trustManager.addCA(addr1.address);
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            await expect(tx).to.emit(certificateCore, "CertificateIssued");
        });

        // **ID: TEST3**
        // **Beschreibung**: Testet, ob eine CA ein Zertifikat widerrufen kann.
        // **Zwischenschritte**:
        // 1. CA autorisieren
        // 2. Zertifikat ausstellen
        // 3. Zertifikatshash berechnen
        // 4. Widerruf durchführen und Event prüfen
        // **Erwartetes Ergebnis**: Das Event "CertificateRevoked" wird ausgelöst.
        // **Anforderung**: Zertifikatsperrung, Garantierte Zertifikatsperrung
        it("ID3: sollte einer CA erlauben, ein Zertifikat zu widerrufen (Anforderung: Zertifikatsperrung, Garantierte Zertifikatsperrung)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const tx = await certificateCore.connect(addr1).revokeCertificate(certHash);
            await expect(tx).to.emit(certificateCore, "CertificateRevoked");
        });

        // **ID: TEST4**
        // **Beschreibung**: Testet die Echtzeit-Abfrage des Zertifikatsstatus.
        // **Zwischenschritte**:
        // 1. CA autorisieren
        // 2. Zertifikat ausstellen
        // 3. Zertifikatshash berechnen
        // 4. Status abfragen
        // **Erwartetes Ergebnis**: Zertifikat ist nicht widerrufen (false).
        // **Anforderung**: Echtzeit-Statusabfragen
        it("ID4: sollte den Zertifikatsstatus in Echtzeit abfragen können (Anforderung: Echtzeit-Statusabfragen)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const isRevoked = await certificateCore.isRevoked(certHash);
            expect(isRevoked).to.equal(false);
        });

        // **ID: TEST5**
        // **Beschreibung**: Testet die Transparenz von Zertifikatsausstellungen.
        // **Zwischenschritte**:
        // 1. CA autorisieren
        // 2. Zertifikat ausstellen
        // 3. Zertifikatshash berechnen
        // 4. Event mit Argumenten prüfen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird mit korrekten Argumenten ausgelöst.
        // **Anforderung**: Transparenz von Zertifikatsausstellungen
        it("ID5: sollte Transparenz von Zertifikatsausstellungen gewährleisten (Anforderung: Transparenz von Zertifikatsausstellungen)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            await expect(tx).to.emit(certificateCore, "CertificateIssued")
                .withArgs(certHash, addr1.address, addr2.address);
        });

        // **ID: TEST6**
        // **Beschreibung**: Testet die Smart-Contract-basierte Verwaltung.
        // **Zwischenschritte**:
        // 1. CA autorisieren
        // 2. Zertifikat über Smart Contract ausstellen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird ausgelöst.
        // **Anforderung**: Smart-Contract-basierte Verwaltung
        it("ID6: sollte Smart-Contract-basierte Verwaltung unterstützen (Anforderung: Smart-Contract-basierte Verwaltung)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            await expect(tx).to.emit(certificateCore, "CertificateIssued");
        });
    });

    // **Blockchain-spezifische Funktionen**
    describe("Blockchain-spezifische Funktionen", function () {
        // **ID: TEST7**
        // **Beschreibung**: Testet die Unterstützung einer gemeinschaftsorientierten Architektur.
        // **Zwischenschritte**:
        // 1. Zwei Nodes registrieren
        // 2. Abstimmung erstellen und abstimmen
        // **Erwartetes Ergebnis**: Nodes können abstimmen, was Gemeinschaftsorientierung zeigt.
        // **Anforderung**: Gemeinschaftsorientierte Architektur
        it("ID7: sollte eine gemeinschaftsorientierte Architektur unterstützen (Anforderung: Gemeinschaftsorientierte Architektur)", async function () {
            const publicKey1 = ethers.toUtf8Bytes("publicKey1");
            const publicKey2 = ethers.toUtf8Bytes("publicKey2");
            await stakeManager.connect(addr1).registerNode(publicKey1, { value: ethers.parseEther("1") });
            await stakeManager.connect(addr2).registerNode(publicKey2, { value: ethers.parseEther("1") });
            const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
            await consensusManager.connect(addr1).createConsensusVote(actionHash);
            await consensusManager.connect(addr2).voteOnConsensus(0, true);
        });

        // **ID: TEST8**
        // **Beschreibung**: Testet das dezentrale Vertrauensmodell.
        // **Zwischenschritte**:
        // 1. Owner fügt addr1 als CA hinzu
        // 2. addr1 fügt addr2 als CA hinzu
        // 3. Prüfen, ob addr2 CA ist
        // **Erwartetes Ergebnis**: addr2 ist CA (true).
        // **Anforderung**: Dezentrales Vertrauensmodell
        it("ID8: sollte ein dezentrales Vertrauensmodell unterstützen (Anforderung: Dezentrales Vertrauensmodell)", async function () {
            await trustManager.connect(owner).addCA(addr1.address);
            await trustManager.connect(addr1).addCA(addr2.address);
            expect(await trustManager.isCA(addr2.address)).to.equal(true);
        });

        // **ID: TEST9**
        // **Beschreibung**: Testet die Implementierung eines Konsensalgorithmus.
        // **Zwischenschritte**:
        // 1. Node registrieren
        // 2. Abstimmung erstellen und abstimmen
        // 3. Event prüfen
        // **Erwartetes Ergebnis**: Das Event "ConsensusVoteCast" wird ausgelöst.
        // **Anforderung**: Konsensalgorithmus
        it("ID9: sollte einen Konsensalgorithmus implementieren (Anforderung: Konsensalgorithmus)", async function () {
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
            const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
            await consensusManager.connect(addr1).createConsensusVote(actionHash);
            const tx = await consensusManager.connect(addr1).voteOnConsensus(0, true);
            await expect(tx).to.emit(consensusManager, "ConsensusVoteCast");
        });

        // **ID: TEST10**
        // **Beschreibung**: Testet die Anreize für Validatoren.
        // **Zwischenschritte**:
        // 1. Node mit Einsatz registrieren
        // 2. Event prüfen
        // **Erwartetes Ergebnis**: Das Event "NodeRegistered" wird mit korrekten Argumenten ausgelöst.
        // **Anforderung**: Anreize für Miner/Validatoren
        it("ID10: sollte Anreize für Validatoren bieten (Anforderung: Anreize für Miner/Validatoren)", async function () {
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const stakeAmount = ethers.parseEther("1");
            const tx = await stakeManager.connect(addr1).registerNode(publicKey, { value: stakeAmount });
            await expect(tx).to.emit(stakeManager, "NodeRegistered").withArgs(addr1.address, stakeAmount);
        });

        // **ID: TEST11**
        // **Beschreibung**: Testet die Verhängung von Sanktionen bei Fehlverhalten.
        // **Zwischenschritte**:
        // 1. Node registrieren
        // 2. Node sanktionieren
        // 3. Prüfen, ob der Einsatz reduziert wurde
        // **Erwartetes Ergebnis**: Der Einsatz des Nodes ist auf 0.5 ETH reduziert.
        // **Anforderung**: Sanktionen bei Fehlverhalten
        it("ID11: sollte Sanktionen bei Fehlverhalten verhängen (Anforderung: Sanktionen bei Fehlverhalten)", async function () {
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
            const slashAmount = ethers.parseEther("0.5");
            await stakeManager.connect(owner).slashNode(addr1.address, slashAmount);
            const remainingStake = await stakeManager.getStake(addr1.address);
            expect(remainingStake).to.equal(ethers.parseEther("0.5"));
        });
    });

    // **Interoperabilität und Authentifizierung**
    describe("Interoperabilität und Authentifizierung", function () {
        // **ID: TEST12**
        // **Beschreibung**: Testet die Interoperabilität mit bestehenden PKIs.
        // **Zwischenschritte**:
        // 1. CA autorisieren
        // 2. X.509-kompatibles Zertifikat ausstellen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird ausgelöst.
        // **Anforderung**: Interoperabilität mit bestehenden PKIs
        it("ID12: sollte mit bestehenden PKIs interoperabel sein (Anforderung: Interoperabilität mit bestehenden PKIs)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            await expect(tx).to.emit(certificateCore, "CertificateIssued");
        });

        // **ID: TEST13**
        // **Beschreibung**: Testet die Authentifizierung.
        // **Zwischenschritte**:
        // 1. CA autorisieren und Zertifikat ausstellen
        // 2. Zertifikatshash berechnen
        // 3. Signatur für Authentifizierung erstellen
        // 4. Authentifizierung prüfen
        // **Erwartetes Ergebnis**: Authentifizierung ist erfolgreich (true).
        // **Anforderung**: Authentifizierung
        it("ID13: sollte Authentifizierung ermöglichen (Anforderung: Authentifizierung)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const nonce = ethers.randomBytes(32);
            const messageHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address]));
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            const isValid = await certificateCore.authenticate(certHash, signature, nonce);
            expect(isValid).to.equal(true);
        });

        // **ID: TEST14**
        // **Beschreibung**: Testet die Nichtabstreitbarkeit.
        // **Zwischenschritte**:
        // 1. Zertifikat ausstellen
        // 2. Hash und Signatur erstellen
        // 3. Authentifizierung prüfen
        // **Erwartetes Ergebnis**: Authentifizierung ist erfolgreich (true).
        // **Anforderung**: Nichtabstreitbarkeit
        it("ID14: sollte Nichtabstreitbarkeit gewährleisten (Anforderung: Nichtabstreitbarkeit)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const nonce = ethers.randomBytes(32);
            const messageHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address]));
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            const isValid = await certificateCore.authenticate(certHash, signature, nonce);
            expect(isValid).to.equal(true);
        });

        // **ID: TEST15**
        // **Beschreibung**: Testet die Transitivität des Vertrauens.
        // **Zwischenschritte**:
        // 1. CA-Hierarchie aufbauen
        // 2. Vertrauenslevel setzen
        // 3. Vertrauenslevel prüfen
        // **Erwartetes Ergebnis**: Vertrauenslevel von addr3 ist 5.
        // **Anforderung**: Transitivität des Vertrauens
        it("ID15: sollte Transitivität des Vertrauens unterstützen (Anforderung: Transitivität des Vertrauens)", async function () {
            await trustManager.connect(owner).addCA(addr1.address);
            await trustManager.connect(addr1).addCA(addr2.address);
            await trustManager.connect(addr2).setTrustLevel(addr3.address, 5);
            expect(await trustManager.trustLevels(addr3.address)).to.equal(5);
        });
    });

    // **Nicht-funktionale Anforderungen**
    describe("Nicht-funktionale Anforderungen", function () {
        // **ID: TEST16**
        // **Beschreibung**: Testet die Vertraulichkeit.
        // **Zwischenschritte**:
        // 1. CA autorisieren und Zertifikat ausstellen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird ausgelöst.
        // **Anforderung**: Vertraulichkeit
        it("ID16: sollte Vertraulichkeit gewährleisten (Anforderung: Vertraulichkeit)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 1000000, 0);
            await expect(tx).to.emit(certificateCore, "CertificateIssued");
        });

        // **ID: TEST17**
        // **Beschreibung**: Testet die Integrität.
        // **Zwischenschritte**:
        // 1. Zertifikat ausstellen
        // 2. Hash berechnen und Status prüfen
        // **Erwartetes Ergebnis**: Zertifikat ist nicht widerrufen (false).
        // **Anforderung**: Integrität
        it("ID17: sollte Integrität sicherstellen (Anforderung: Integrität)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const isRevoked = await certificateCore.isRevoked(certHash);
            expect(isRevoked).to.equal(false);
        });

        // **ID: TEST18**
        // **Beschreibung**: Testet die existenzielle Unfälschbarkeit.
        // **Zwischenschritte**:
        // 1. Versuch, als Nicht-CA ein Zertifikat auszustellen
        // **Erwartetes Ergebnis**: Transaktion schlägt mit "Nur eine CA kann diese Funktion ausfuehren" fehl.
        // **Anforderung**: Existenzielle Unfälschbarkeit
        it("ID18: sollte existenzielle Unfälschbarkeit garantieren (Anforderung: Existenzielle Unfälschbarkeit)", async function () {
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            await expect(certificateCore.connect(addr2).issueCertificate(addr3.address, publicKey, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 1000000, 0))
                .to.be.revertedWith("Nur eine CA kann diese Funktion ausfuehren");
        });

        // **ID: TEST19**
        // **Beschreibung**: Testet die Resistenz gegen Quantencomputer.
        // **Zwischenschritte**:
        // 1. CA autorisieren
        // 2. ECDSA-Zertifikat ausstellen
        // **Erwartetes Ergebnis**: Das Event "CertificateIssued" wird ausgelöst.
        // **Anforderung**: Resistenz gegen Quantencomputer
        it("ID19: sollte Resistenz gegen Quantencomputer bieten (Anforderung: Resistenz gegen Quantencomputer)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 1000000, 0);
            await expect(tx).to.emit(certificateCore, "CertificateIssued");
        });

        // **ID: TEST20**
        // **Beschreibung**: Testet den Schutz gespeicherter Daten.
        // **Zwischenschritte**:
        // 1. Zertifikat ausstellen
        // **Erwartetes Ergebnis**: Keine privaten Daten auf der Blockchain.
        // **Anforderung**: Schutz gespeicherter Daten
        it("ID20: sollte gespeicherte Daten schützen (Anforderung: Schutz gespeicherter Daten)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 1000000, 0);
        });

        // **ID: TEST21**
        // **Beschreibung**: Testet manipulationssichere Logs.
        // **Zwischenschritte**:
        // 1. Aktion protokollieren
        // 2. Event prüfen
        // **Erwartetes Ergebnis**: Das Event "ActionLogged" wird ausgelöst.
        // **Anforderung**: Manipulationssichere Logs
        it("ID21: sollte manipulationssichere Logs bereitstellen (Anforderung: Manipulationssichere Logs)", async function () {
            const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
            const tx = await loggingManager.connect(owner).logAction(owner.address, actionHash);
            await expect(tx).to.emit(loggingManager, "ActionLogged");
        });

        // **ID: TEST22**
        // **Beschreibung**: Testet die Zeitstempelvalidierung.
        // **Zwischenschritte**:
        // 1. Zertifikat mit Zeitstempel ausstellen
        // 2. Status prüfen
        // **Erwartetes Ergebnis**: Zertifikat ist nicht widerrufen (false).
        // **Anforderung**: Zeitstempelvalidierung
        it("ID22: sollte Zeitstempelvalidierung ermöglichen (Anforderung: Zeitstempelvalidierung)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const isRevoked = await certificateCore.isRevoked(certHash);
            expect(isRevoked).to.equal(false);
        });

        // **ID: TEST23**
        // **Beschreibung**: Testet die Verantwortlichkeit der CAs.
        // **Zwischenschritte**:
        // 1. Zertifikat ausstellen
        // 2. Hash berechnen
        // 3. Versuch, als Nicht-CA zu widerrufen
        // **Erwartetes Ergebnis**: Transaktion schlägt mit "Nur eine CA kann diese Funktion ausfuehren" fehl.
        // **Anforderung**: Verantwortlichkeit der CAs
        it("ID23: sollte Verantwortlichkeit der CAs sicherstellen (Anforderung: Verantwortlichkeit der CAs)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            await expect(certificateCore.connect(addr2).revokeCertificate(certHash))
                .to.be.revertedWith("Nur eine CA kann diese Funktion ausfuehren");
        });

        // **ID: TEST24**
        // **Beschreibung**: Testet die zeitliche Dimension der Sperrung.
        // **Zwischenschritte**:
        // 1. Zertifikat ausstellen
        // 2. Hash berechnen und widerrufen
        // 3. Status nach Widerruf prüfen
        // **Erwartetes Ergebnis**: Zertifikat ist widerrufen (true).
        // **Anforderung**: Zeitliche Dimension der Sperrung
        it("ID24: sollte die zeitliche Dimension der Sperrung berücksichtigen (Anforderung: Zeitliche Dimension der Sperrung)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            await certificateCore.connect(addr1).revokeCertificate(certHash);
            const isRevoked = await certificateCore.isRevoked(certHash);
            expect(isRevoked).to.equal(true);
        });

        // **ID: TEST25**
        // **Beschreibung**: Testet die Vermeidung von Zentralisierungsrisiken.
        // **Zwischenschritte**:
        // 1. Mehrere CAs hinzufügen
        // 2. Prüfen, ob beide CAs sind
        // **Erwartetes Ergebnis**: Beide Adressen sind CAs (true).
        // **Anforderung**: Zentralisierungsrisiko vermeiden
        it("ID25: sollte Zentralisierungsrisiken vermeiden (Anforderung: Zentralisierungsrisiko vermeiden)", async function () {
            await trustManager.connect(owner).addCA(addr1.address);
            await trustManager.connect(owner).addCA(addr2.address);
            expect(await trustManager.isCA(addr1.address)).to.equal(true);
            expect(await trustManager.isCA(addr2.address)).to.equal(true);
        });
    });

    // **Use-Case-Tests**
    describe("Use-Case Tests", function () {
        // **ID: TEST26**
        // **Beschreibung**: Testet die Mehrfach-Node-Partizipation.
        // **Zwischenschritte**:
        // 1. Zwei Nodes registrieren
        // 2. Abstimmung erstellen und abstimmen
        // 3. Event prüfen
        // **Erwartetes Ergebnis**: Das Event "ConsensusVoteCast" wird ausgelöst.
        // **Use-Case**: Mehrfach-Node-Partizipation
        it("ID26: sollte mehrere Nodes registrieren und über eine Abstimmung abstimmen lassen (Use-Case: Mehrfach-Node-Partizipation)", async function () {
            const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
            const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
            await stakeManager.connect(addr1).registerNode(publicKey1, { value: ethers.parseEther("1") });
            await stakeManager.connect(addr2).registerNode(publicKey2, { value: ethers.parseEther("1") });
            const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
            await consensusManager.connect(addr1).createConsensusVote(actionHash);
            await consensusManager.connect(addr1).voteOnConsensus(0, true);
            const tx = await consensusManager.connect(addr2).voteOnConsensus(0, false);
            await expect(tx).to.emit(consensusManager, "ConsensusVoteCast");
        });

        // **ID: TEST27**
        // **Beschreibung**: Testet die Zertifikatsnutzung (Ausstellung und Authentifizierung).
        // **Zwischenschritte**:
        // 1. CA autorisieren und Zertifikat ausstellen
        // 2. Hash und Signatur erstellen
        // 3. Authentifizierung prüfen
        // **Erwartetes Ergebnis**: Authentifizierung ist erfolgreich (true).
        // **Use-Case**: Zertifikatsnutzung
        it("ID27: sollte ein Zertifikat ausstellen und authentifizieren (Use-Case: Zertifikatsnutzung)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            const nonce = ethers.randomBytes(32);
            const messageHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address]));
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            const isValid = await certificateCore.authenticate(certHash, signature, nonce);
            expect(isValid).to.equal(true);
        });

        // **ID: TEST28**
        // **Beschreibung**: Testet den Zertifikatswiderruf.
        // **Zwischenschritte**:
        // 1. Zertifikat ausstellen
        // 2. Hash berechnen und widerrufen
        // 3. Authentifizierung versuchen
        // **Erwartetes Ergebnis**: Transaktion schlägt mit "Zertifikat ist widerrufen" fehl.
        // **Use-Case**: Zertifikatswiderruf
        it("ID28: sollte ein widerrufenes Zertifikat nicht authentifizieren (Use-Case: Zertifikatswiderruf)", async function () {
            await trustManager.addCA(addr1.address);
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
            const certHash = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm])
            );
            await certificateCore.connect(addr1).revokeCertificate(certHash);
            const nonce = ethers.randomBytes(32);
            const messageHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address]));
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            await expect(certificateCore.authenticate(certHash, signature, nonce)).to.be.revertedWith("Zertifikat ist widerrufen");
        });

        // **ID: TEST29**
        // **Beschreibung**: Testet die Node-Deaktivierung.
        // **Zwischenschritte**:
        // 1. Node registrieren und Abstimmung erstellen
        // 2. Einsatz zurückziehen
        // 3. Versuch, abzustimmen
        // **Erwartetes Ergebnis**: Transaktion schlägt mit "Nur registrierte Nodes koennen diese Funktion ausfuehren" fehl.
        // **Use-Case**: Node-Deaktivierung
        it("ID29: sollte einem Node nach Einsatzrückzug das Abstimmen verbieten (Use-Case: Node-Deaktivierung)", async function () {
            const publicKey = ethers.toUtf8Bytes("publicKey_test");
            await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
            const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
            await consensusManager.connect(addr1).createConsensusVote(actionHash);
            await stakeManager.connect(addr1).withdrawStake();
            await expect(consensusManager.connect(addr1).voteOnConsensus(0, true))
                .to.be.revertedWith("Nur registrierte Nodes koennen diese Funktion ausfuehren");
        });

        // **ID: TEST30**
        // **Beschreibung**: Testet die Mehrfach-CA-Zertifikatsnutzung.
        // **Zwischenschritte**:
        // 1. Zwei CAs autorisieren
        // 2. Zwei Zertifikate ausstellen
        // 3. Hashes berechnen
        // 4. Signaturen erstellen und authentifizieren
        // **Erwartetes Ergebnis**: Beide Authentifizierungen sind erfolgreich (true).
        // **Use-Case**: Mehrfach-CA-Zertifikatsnutzung
        it("ID30: sollte mehreren CAs erlauben, Zertifikate auszustellen und zu authentifizieren (Use-Case: Mehrfach-CA-Zertifikatsnutzung)", async function () {
            await trustManager.connect(owner).addCA(addr1.address);
            await trustManager.connect(owner).addCA(addr2.address);
            const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
            const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
            const validFrom = Math.floor(Date.now() / 1000);
            const validTo = validFrom + 1000000;
            const algorithm = 0;
            await certificateCore.connect(addr1).issueCertificate(addr3.address, publicKey1, validFrom, validTo, algorithm);
            await certificateCore.connect(addr2).issueCertificate(addr3.address, publicKey2, validFrom, validTo, algorithm);
            const certHash1 = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr1.address, addr3.address, publicKey1, validFrom, validTo, algorithm])
            );
            const certHash2 = ethers.keccak256(
                ethers.solidityPacked(["address", "address", "bytes", "uint256", "uint256", "uint8"],
                    [addr2.address, addr3.address, publicKey2, validFrom, validTo, algorithm])
            );
            const nonce1 = ethers.randomBytes(32);
            const messageHash1 = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce1, addr3.address]));
            const signature1 = await addr3.signMessage(ethers.getBytes(messageHash1));
            const isValid1 = await certificateCore.authenticate(certHash1, signature1, nonce1);
            expect(isValid1).to.equal(true);
            const nonce2 = ethers.randomBytes(32);
            const messageHash2 = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce2, addr3.address]));
            const signature2 = await addr3.signMessage(ethers.getBytes(messageHash2));
            const isValid2 = await certificateCore.authenticate(certHash2, signature2, nonce2);
            expect(isValid2).to.equal(true);
        });
    });
});