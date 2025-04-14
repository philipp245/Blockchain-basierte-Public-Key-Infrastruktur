// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für das Zusammenspiel der Smart Contracts in einer Blockchain-basierten 
//               Public Key Infrastructure (PKI). 
//               Testet die Kernfunktionalitäten wie Zertifikatsausstellung, -widerruf, 
//               -authentifizierung, Vertrauensmanagement und Konsensmechanismen.

const { expect } = require("chai");
const { ethers } = require("hardhat");
const chai = require("chai");

describe("Langfristige PKI-System-Tests ohne Zurücksetzen", function () {
    let CertificateCore, StakeManager, TrustManager, LoggingManager, ConsensusManager;
    let certificateCore, stakeManager, trustManager, loggingManager, consensusManager;
    let owner, addr1, addr2, addr3, addr4;

    // **ID: SETUP**
    // **Beschreibung**: Initialisiert alle Smart Contracts und Signer für die Tests.
    // **Zwischenschritte**:
    // 1. Signer (owner, addr1, addr2, addr3, addr4) abrufen
    // 2. LoggingManager deployen
    // 3. StakeManager deployen und mit LoggingManager verknüpfen
    // 4. TrustManager deployen und mit LoggingManager verknüpfen
    // 5. ConsensusManager deployen und mit StakeManager/LoggingManager verknüpfen
    // 6. CertificateCore deployen und mit TrustManager, StakeManager, LoggingManager verknüpfen
    // 7. Berechtigungen im LoggingManager setzen
    // 8. ConsensusManager in StakeManager konfigurieren
    // **Erwartetes Ergebnis**: Alle Verträge sind korrekt initialisiert und bereit für Tests.
    before(async function () {
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

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

        const CertificateCoreFactory = await ethers.getContractFactory("CertificateCore");
        certificateCore = await CertificateCoreFactory.deploy(
            trustManager.target,
            stakeManager.target,
            loggingManager.target
        );
        await certificateCore.waitForDeployment();

        await loggingManager.addAuthorized(stakeManager.target);
        await loggingManager.addAuthorized(trustManager.target);
        await loggingManager.addAuthorized(certificateCore.target);
        await loggingManager.addAuthorized(consensusManager.target);

        await stakeManager.setConsensusManager(consensusManager.target);
    });

    // **ID: TEST1**
    // **Beschreibung**: Testet, ob eine CA autorisiert und ein Zertifikat ausgestellt werden kann.
    // **Zwischenschritte**:
    // 1. addr1 als CA im TrustManager autorisieren
    // 2. Zertifikat für addr2 mit öffentlichem Schlüssel ausstellen
    // 3. Hash des Zertifikats berechnen
    // 4. Prüfen, ob das Zertifikat nicht widerrufen ist
    // **Erwartetes Ergebnis**: Das Zertifikat ist gültig und nicht widerrufen (false).
    it("ID1: sollte eine CA autorisieren und ein Zertifikat ausstellen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("mein_public_key");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 864000; // 10 Tage Gültigkeit
        const algorithm = 0;
        await certificateCore.connect(addr1).issueCertificate(
            addr2.address,
            publicKey,
            validFrom,
            validTo,
            algorithm
        );
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        expect(await certificateCore.isRevoked(certHash)).to.equal(false);
    });

    // **ID: TEST2**
    // **Beschreibung**: Testet, ob ein Zertifikat erfolgreich authentifiziert werden kann.
    // **Zwischenschritte**:
    // 1. Zertifikatsdaten definieren (wie in TEST1)
    // 2. Hash des Zertifikats berechnen
    // 3. Nonce generieren und Nachricht signieren
    // 4. Authentifizierung durchführen
    // **Erwartetes Ergebnis**: Authentifizierung ist erfolgreich (true).
    it("ID2: sollte das Zertifikat erfolgreich authentifizieren", async function () {
        const publicKey = ethers.toUtf8Bytes("mein_public_key");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 864000;
        const algorithm = 0;
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        const nonce = ethers.randomBytes(32);
        const messageHash = ethers.keccak256(
            ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address])
        );
        const signature = await addr2.signMessage(ethers.getBytes(messageHash));
        const isValid = await certificateCore.authenticate(certHash, signature, nonce);
        expect(isValid).to.equal(true);
    });

    // **ID: TEST3**
    // **Beschreibung**: Testet, ob ein Zertifikat widerrufen werden kann.
    // **Zwischenschritte**:
    // 1. Zertifikatsdaten definieren
    // 2. Hash des Zertifikats berechnen
    // 3. Zertifikat von addr1 widerrufen
    // 4. Prüfen, ob das Zertifikat widerrufen ist
    // **Erwartetes Ergebnis**: Das Zertifikat ist widerrufen (true).
    it("ID3: sollte das Zertifikat widerrufen", async function () {
        const publicKey = ethers.toUtf8Bytes("mein_public_key");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 864000;
        const algorithm = 0;
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        await certificateCore.connect(addr1).revokeCertificate(certHash);
        expect(await certificateCore.isRevoked(certHash)).to.equal(true);
    });

    // **ID: TEST4**
    // **Beschreibung**: Testet, ob die Authentifizierung nach Widerruf verweigert wird.
    // **Zwischenschritte**:
    // 1. Neues Zertifikat für addr2 ausstellen
    // 2. Hash des Zertifikats berechnen
    // 3. Zertifikat widerrufen
    // 4. Authentifizierung versuchen
    // **Erwartetes Ergebnis**: Transaktion schlägt mit "Zertifikat ist widerrufen" fehl.
    it("ID4: sollte die Authentifizierung nach Widerruf verweigern", async function () {
        const publicKey = ethers.toUtf8Bytes("mein_public_key_unique");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 864000;
        const algorithm = 0;
        await certificateCore.connect(addr1).issueCertificate(
            addr2.address,
            publicKey,
            validFrom,
            validTo,
            algorithm
        );
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        await certificateCore.connect(addr1).revokeCertificate(certHash);
        const nonce = ethers.randomBytes(32);
        const messageHash = ethers.keccak256(
            ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address])
        );
        const signature = await addr2.signMessage(ethers.getBytes(messageHash));
        await expect(
            certificateCore.authenticate(certHash, signature, nonce)
        ).to.be.revertedWith("Zertifikat ist widerrufen");
    });

    // **ID: TEST5**
    // **Beschreibung**: Testet, ob ein abgelaufenes Zertifikat als ungültig behandelt wird.
    // **Zwischenschritte**:
    // 1. Zertifikat mit kurzer Gültigkeit ausstellen
    // 2. Hash des Zertifikats berechnen
    // 3. Zeit um 2 Tage vorspulen
    // 4. Authentifizierung versuchen
    // **Erwartetes Ergebnis**: Transaktion schlägt mit "Zertifikat ist ungueltig" fehl.
    it("ID5: sollte das Zertifikat nach Ablauf der Gültigkeit als ungültig behandeln", async function () {
        const publicKey2 = ethers.toUtf8Bytes("mein_public_key_2");
        const validFrom2 = Math.floor(Date.now() / 1000);
        const validTo2 = validFrom2 + 86400; // 1 Tag Gültigkeit
        const algorithm2 = 0;
        await certificateCore.connect(addr1).issueCertificate(
            addr2.address,
            publicKey2,
            validFrom2,
            validTo2,
            algorithm2
        );
        const certHash2 = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey2, validFrom2, validTo2, algorithm2]
            )
        );
        await ethers.provider.send("evm_increaseTime", [172800]); // 2 Tage
        await ethers.provider.send("evm_mine", []);
        const nonce = ethers.randomBytes(32);
        const messageHash = ethers.keccak256(
            ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address])
        );
        const signature = await addr2.signMessage(ethers.getBytes(messageHash));
        await expect(
            certificateCore.authenticate(certHash2, signature, nonce)
        ).to.be.revertedWith("Zertifikat ist ungueltig");
    });

    // **ID: TEST6**
    // **Beschreibung**: Testet, ob ein Zertifikat widerrufen wird und das Event ausgelöst wird.
    // **Zwischenschritte**:
    // 1. Zertifikat ausstellen
    // 2. Hash des Zertifikats berechnen
    // 3. Zertifikat widerrufen
    // 4. Transaktion prüfen
    // 5. Event "CertificateRevoked" prüfen
    // 6. Widerrufstatus prüfen
    // **Erwartetes Ergebnis**: Event wird ausgelöst, Zertifikat ist widerrufen (true).
    it("ID6: sollte ein Zertifikat widerrufen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0;
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        const tx = await certificateCore.connect(addr1).revokeCertificate(certHash);
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
        const eventFilter = certificateCore.filters.CertificateRevoked();
        const events = await certificateCore.queryFilter(eventFilter, receipt.blockNumber, receipt.blockNumber);
        expect(events.length).to.be.greaterThan(0);
        expect(events[0].args[0]).to.equal(certHash);
        expect(await certificateCore.isRevoked(certHash)).to.equal(true);
    });

    // **ID: TEST7**
    // **Beschreibung**: Testet, ob ein abgelaufenes Zertifikat als ungültig erkannt wird.
    // **Zwischenschritte**:
    // 1. Zertifikat mit abgelaufener Gültigkeit ausstellen
    // 2. Hash des Zertifikats berechnen
    // 3. Gültigkeit prüfen
    // **Erwartetes Ergebnis**: Zertifikat ist ungültig (false).
    it("ID7: sollte ein abgelaufenes Zertifikat als ungültig erkennen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000) - 2000;
        const validTo = validFrom + 1000; // Abgelaufen
        const algorithm = 0;
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        const isValid = await certificateCore.isCertificateValid(certHash);
        expect(isValid).to.equal(false);
    });

    // **ID: TEST8**
    // **Beschreibung**: Testet, ob mehrere Co-Signer zu einem Zertifikat hinzugefügt werden können.
    // **Zwischenschritte**:
    // 1. Zertifikat ausstellen
    // 2. Hash des Zertifikats berechnen
    // 3. addr3 und addr4 als CAs autorisieren
    // 4. addr3 und addr4 als Co-Signer hinzufügen
    // 5. Co-Signer prüfen
    // **Erwartetes Ergebnis**: Zertifikat hat zwei Co-Signer (addr3, addr4).
    it("ID8: sollte mehrere Co-Signer für ein Zertifikat erlauben", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test_cosign");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0;
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );
        await trustManager.addCA(addr3.address);
        await trustManager.addCA(addr4.address);
        await certificateCore.connect(addr3).coSignCertificate(certHash);
        await certificateCore.connect(addr4).coSignCertificate(certHash);
        const coSigners = await certificateCore.getCosigners(certHash);
        expect(coSigners.length).to.equal(2);
        expect(coSigners).to.include(addr3.address);
        expect(coSigners).to.include(addr4.address);
    });

    // **ID: TEST9**
    // **Beschreibung**: Testet, ob Vertrauen entzogen werden kann und Aktionen danach verhindert werden.
    // **Zwischenschritte**:
    // 1. Vertrauenslevel für addr1 setzen
    // 2. addr1 delegiert Vertrauen an addr2
    // 3. Vertrauen prüfen
    // 4. Vertrauen entziehen
    // 5. Vertrauen erneut prüfen
    // 6. Aktion als addr2 versuchen
    // **Erwartetes Ergebnis**: Aktion schlägt mit "Nur eine CA kann diese Funktion ausfuehren" fehl.
    it("ID9: sollte Vertrauen entziehen und Aktionen verhindern", async function () {
        await trustManager.connect(owner).setTrustLevel(addr1.address, 10);
        await trustManager.connect(addr1).delegateTrust(addr2.address);
        const trustedBy = await trustManager.trustedBy(addr2.address);
        expect(trustedBy).to.equal(addr1.address);
        await trustManager.connect(addr1).revokeTrust(addr2.address);
        const trustedByAfterRevoke = await trustManager.trustedBy(addr2.address);
        expect(trustedByAfterRevoke).to.equal(ethers.ZeroAddress);
        await expect(
            trustManager.connect(addr2).setTrustLevel(addr3.address, 5)
        ).to.be.revertedWith("Nur eine CA kann diese Funktion ausfuehren");
    });

    // **ID: TEST10**
    // **Beschreibung**: Testet, ob der Konsens mit ungleichem Stake korrekt ermittelt wird.
    // **Zwischenschritte**:
    // 1. Nodes mit unterschiedlichem Stake registrieren (addr1: 2 ETH, addr2: 1 ETH)
    // 2. Abstimmung erstellen
    // 3. addr1 stimmt für true, addr2 für false
    // 4. Konsens prüfen
    // **Erwartetes Ergebnis**: Konsens ist true (addr1 gewinnt wegen höherem Stake).
    it("ID10: sollte Konsens mit ungleichem Stake korrekt ermitteln", async function () {
        const publicKey1 = ethers.toUtf8Bytes("publicKey1");
        const publicKey2 = ethers.toUtf8Bytes("publicKey2");
        await stakeManager.connect(addr1).registerNode(publicKey1, { value: ethers.parseEther("2") });
        await stakeManager.connect(addr2).registerNode(publicKey2, { value: ethers.parseEther("1") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await consensusManager.connect(addr1).createConsensusVote(actionHash);
        await consensusManager.connect(addr1).voteOnConsensus(0, true);
        await consensusManager.connect(addr2).voteOnConsensus(0, false);
        const result = await consensusManager.getVoteResult(0);
        expect(result).to.equal(true);
    });
});