// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für den CertificateCore Smart Contract.
// Testet die Kernfunktionalitäten der Zertifikatsausstellung, -widerruf, -authentifizierung und -verwaltung.

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateCore Contract Tests", function () {
    let CertificateCore, StakeManager, TrustManager, ConsensusManager, LoggingManager;
    let certificateCore, stakeManager, trustManager, consensusManager, loggingManager;
    let owner, addr1, addr2, addr3;

    // Einrichtungsfunktion, die vor jedem Testfall ausgeführt wird
    beforeEach(async function () {
        // Testkonten (Signierer) aus Hardhat abrufen
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
        // LoggingManager-Vertrag bereitstellen
        const LoggingManagerFactory = await ethers.getContractFactory("LoggingManager");
        loggingManager = await LoggingManagerFactory.deploy();
        await loggingManager.waitForDeployment();
    
        // StakeManager-Vertrag mit LoggingManager-Abhängigkeit bereitstellen
        const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
        stakeManager = await StakeManagerFactory.deploy(loggingManager.target);
        await stakeManager.waitForDeployment();
    
        // TrustManager-Vertrag mit LoggingManager-Abhängigkeit bereitstellen
        const TrustManagerFactory = await ethers.getContractFactory("TrustManager");
        trustManager = await TrustManagerFactory.deploy(loggingManager.target);
        await trustManager.waitForDeployment();
    
        // TrustManager im LoggingManager autorisieren
        await loggingManager.addAuthorized(trustManager.target);
    
        // ConsensusManager-Vertrag mit Abhängigkeiten bereitstellen
        const ConsensusManagerFactory = await ethers.getContractFactory("ConsensusManager");
        consensusManager = await ConsensusManagerFactory.deploy(stakeManager.target, loggingManager.target);
        await consensusManager.waitForDeployment();
    
        // ConsensusManager im StakeManager verknüpfen
        await stakeManager.setConsensusManager(consensusManager.target);
    
        // Hauptvertrag CertificateCore mit allen Abhängigkeiten bereitstellen
        const CertificateCoreFactory = await ethers.getContractFactory("CertificateCore");
        certificateCore = await CertificateCoreFactory.deploy(trustManager.target, stakeManager.target, loggingManager.target);
        await certificateCore.waitForDeployment();
    
        // CertificateCore im LoggingManager autorisieren
        await loggingManager.addAuthorized(certificateCore.target);
    });

    // Testfall: Prüft, ob eine Zertifizierungsstelle (CA) ein Zertifikat ausstellen kann
    it("sollte einer CA erlauben, ein Zertifikat erfolgreich auszustellen", async function () {
        // addr1 als CA hinzufügen
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000); // Aktueller Zeitstempel
        const validTo = validFrom + 1000000; // Gültig für ~11,5 Tage
        const algorithm = 0; // ECDSA-Algorithmus

        // Zertifikat ausstellen und auf CertificateIssued-Event prüfen
        const tx = await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await expect(tx).to.emit(certificateCore, "CertificateIssued");
    });

    // Testfall: Stellt sicher, dass Nicht-CAs kein Zertifikat ausstellen können
    it("sollte verhindern, dass Nicht-CAs ein Zertifikat ausstellen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Versuch, ein Zertifikat mit einem Nicht-CA-Konto (addr2) auszustellen
        await expect(certificateCore.connect(addr2).issueCertificate(addr3.address, publicKey, validFrom, validTo, algorithm))
            .to.be.revertedWith("Nur eine CA kann diese Funktion ausfuehren");
    });

    // Testfall: Prüft, ob eine CA ein ausgestelltes Zertifikat widerrufen kann
    it("sollte einer CA erlauben, ein Zertifikat erfolgreich zu widerrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und anschließend widerrufen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const tx = await certificateCore.connect(addr1).revokeCertificate(certHash);
        await expect(tx).to.emit(certificateCore, "CertificateRevoked");
    });

    // Testfall: Stellt sicher, dass nicht existierende Zertifikate nicht widerrufen werden können
    it("sollte das Widerrufen eines nicht existierenden Zertifikats verhindern", async function () {
        await trustManager.addCA(addr1.address);
        const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));

        // Versuch, ein nicht existierendes Zertifikat zu widerrufen
        await expect(certificateCore.connect(addr1).revokeCertificate(nonExistentHash))
            .to.be.revertedWith("Zertifikat existiert nicht");
    });

    // Testfall: Prüft die Authentifizierung eines Zertifikats mit gültiger Signatur
    it("sollte ein gültiges Zertifikat authentifizieren", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);

        // Signierte Nachricht für Authentifizierung erstellen
        const nonce = ethers.randomBytes(32);
        const messageHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address]));
        const signature = await addr2.signMessage(ethers.getBytes(messageHash));

        // Authentifizierung prüfen
        const isValid = await certificateCore.authenticate(certHash, signature, nonce);
        expect(isValid).to.equal(true);
    });

    // Testfall: Stellt sicher, dass widerrufene Zertifikate nicht authentifiziert werden können
    it("sollte ein widerrufenes Zertifikat nicht authentifizieren", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und widerrufen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).revokeCertificate(certHash);

        // Authentifizierung mit widerrufenem Zertifikat versuchen
        const nonce = ethers.randomBytes(32);
        const messageHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [nonce, addr2.address]));
        const signature = await addr2.signMessage(ethers.getBytes(messageHash));

        await expect(certificateCore.authenticate(certHash, signature, nonce))
            .to.be.revertedWith("Zertifikat ist widerrufen");
    });

    // Testfall: Prüft die Erneuerung eines Zertifikats durch eine CA
    it("sollte einer CA erlauben, ein Zertifikat erfolgreich zu erneuern", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);

        // Zertifikat mit neuem Gültigkeitszeitraum erneuern
        const newValidTo = validTo + 1000000;
        const dataHash = ethers.keccak256(ethers.solidityPacked(["bytes32"], [certHash]));
        const signature = await addr1.signMessage(ethers.getBytes(dataHash));

        const tx = await certificateCore.connect(addr1).renewCertificate(certHash, newValidTo, signature);
        await expect(tx).to.emit(certificateCore, "CertificateRenewed");
    });

    // Testfall: Stellt sicher, dass widerrufene Zertifikate nicht erneuert werden können
    it("sollte die Erneuerung eines widerrufenen Zertifikats verhindern", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und widerrufen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).revokeCertificate(certHash);

        // Versuch, das widerrufene Zertifikat zu erneuern
        const newValidTo = validTo + 1000000;
        const dataHash = ethers.keccak256(ethers.solidityPacked(["bytes32"], [certHash]));
        const signature = await addr1.signMessage(ethers.getBytes(dataHash));

        await expect(certificateCore.connect(addr1).renewCertificate(certHash, newValidTo, signature))
            .to.be.revertedWith("Zertifikat ist widerrufen");
    });

    // Testfall: Prüft das Abrufen von Zertifikatsdetails
    it("sollte Zertifikatsdetails korrekt abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);

        // Zertifikatsdetails abrufen und prüfen
        const [issuer, subject, retrievedPublicKey, retrievedValidFrom, retrievedValidTo, revoked, retrievedAlgorithm] = 
            await certificateCore.getCertificate(certHash);
        expect(issuer).to.equal(addr1.address);
        expect(subject).to.equal(addr2.address);
        expect(retrievedPublicKey).to.equal(ethers.hexlify(publicKey));
        expect(retrievedValidFrom).to.equal(validFrom);
        expect(retrievedValidTo).to.equal(validTo);
        expect(revoked).to.equal(false);
        expect(retrievedAlgorithm).to.equal(algorithm);
    });

    // Testfall: Prüft das Mitunterzeichnen eines Zertifikats durch eine andere CA
    it("sollte einer CA erlauben, ein Zertifikat erfolgreich mitzuunterzeichnen", async function () {
        await trustManager.addCA(addr1.address);
        await trustManager.addCA(addr3.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und mitunterzeichnen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const tx = await certificateCore.connect(addr3).coSignCertificate(certHash);
        await expect(tx).to.emit(certificateCore, "CertificateCoSigned");
    });

    // Testfall: Verhindert, dass der Aussteller sein eigenes Zertifikat mitunterzeichnet
    it("sollte verhindern, dass der Aussteller sein eigenes Zertifikat mitunterzeichnet", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und Selbst-Mitunterzeichnung versuchen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await expect(certificateCore.connect(addr1).coSignCertificate(certHash))
            .to.be.revertedWith("Issuer darf nicht cosignen");
    });

    // Testfall: Prüft die Gültigkeitsprüfung eines Zertifikats
    it("sollte prüfen, ob ein Zertifikat gültig ist", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und Gültigkeit prüfen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const isValid = await certificateCore.isCertificateValid(certHash);
        expect(isValid).to.equal(true);
    });

    // Testfall: Prüft, ob widerrufene Zertifikate als ungültig markiert werden
    it("sollte prüfen, ob ein widerrufenes Zertifikat ungültig ist", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen, widerrufen und Gültigkeit prüfen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).revokeCertificate(certHash);
        const isValid = await certificateCore.isCertificateValid(certHash);
        expect(isValid).to.equal(false);
    });

    // Testfall: Ruft die Mitunterzeichner eines Zertifikats ab
    it("sollte die Mitunterzeichner eines Zertifikats abrufen", async function () {
        await trustManager.addCA(addr1.address);
        await trustManager.addCA(addr3.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und Mitunterzeichner hinzufügen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr3).coSignCertificate(certHash);

        // Mitunterzeichnerliste prüfen
        const cosigners = await certificateCore.getCosigners(certHash);
        expect(cosigners.length).to.equal(1);
        expect(cosigners[0]).to.equal(addr3.address);
    });

    // Testfall: Prüft die Signatur eines Zertifikats
    it("sollte eine Zertifikatssignatur verifizieren", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);

        // Testdaten signieren und verifizieren
        const data = ethers.toUtf8Bytes("test_data");
        const dataHash = ethers.keccak256(data);
        const signature = await addr2.signMessage(ethers.getBytes(dataHash));
        const isValid = await certificateCore.verifyCertificateSignature(certHash, dataHash, signature);
        expect(isValid).to.equal(true);
    });

    // Testfall: Ruft die Historie eines Zertifikats ab
    it("sollte die Historie eines Zertifikats abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und widerrufen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).revokeCertificate(certHash);

        // Historien-Einträge prüfen
        const history = await certificateCore.getCertificateHistory(certHash);
        expect(history.length).to.equal(2);
        expect(history[0].txType).to.equal("issue");
        expect(history[1].txType).to.equal("revoke");
    });

    // Testfall: Ruft Zertifikate nach Subject ab
    it("sollte Zertifikate nach Subject abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
        const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zwei Zertifikate für denselben Subject ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey1, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey2, validFrom, validTo, algorithm);

        // Abgerufene Zertifikate prüfen
        const certs = await certificateCore.getCertificatesBySubject(addr2.address);
        expect(certs.length).to.equal(2);
    });

    // Testfall: Prüft die Aktualisierung des öffentlichen Schlüssels durch den Subject
    it("sollte dem Subject erlauben, den öffentlichen Schlüssel eines Zertifikats zu aktualisieren", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und öffentlichen Schlüssel aktualisieren
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const newPublicKey = ethers.toUtf8Bytes("new_public_key");
        await certificateCore.connect(addr2).updateCertificatePublicKey(certHash, newPublicKey);

        // Aktualisierten öffentlichen Schlüssel prüfen
        const cert = await certificateCore.getCertificate(certHash);
        expect(cert[2]).to.equal(ethers.hexlify(newPublicKey));
    });

    // Testfall: Prüft das Importieren eines externen Zertifikats
    it("sollte einer CA erlauben, ein externes Zertifikat zu importieren", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA
        const pemData = ethers.toUtf8Bytes("-----BEGIN CERTIFICATE-----\nMII...");
        const voteId = 0; // Beispiel-Vote-ID

        // Externes Zertifikat importieren
        await certificateCore.connect(addr1).importExternalCertificate(
            addr2.address,
            publicKey,
            validFrom,
            validTo,
            algorithm,
            pemData,
            voteId
        );

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "bytes", "uint256", "uint256", "uint8"],
                [addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Importierte Zertifikatsdetails prüfen
        const cert = await certificateCore.getCertificate(certHash);
        expect(cert[0]).to.equal(addr1.address);
        expect(cert[1]).to.equal(addr2.address);
        expect(cert[2]).to.equal(ethers.hexlify(publicKey));
        expect(cert[3]).to.equal(validFrom);
        expect(cert[4]).to.equal(validTo);
        expect(cert[6]).to.equal(algorithm);

        // PEM-Daten prüfen
        const retrievedPem = await certificateCore.getPEM(certHash);
        expect(retrievedPem).to.equal(ethers.hexlify(pemData));
    });

    // Testfall: Prüft die Ausführung eines importierten Zertifikats durch CA und registrierten Node
    it("sollte einer CA und einem registrierten Node erlauben, ein importiertes Zertifikat auszuführen", async function () {
        // addr1 als Zertifizierungsstelle hinzufügen
        await trustManager.addCA(addr1.address);
        
        // Beispiel-öffentlichen Schlüssel als Bytes erstellen
        const publicKey = ethers.toUtf8Bytes("publicKey_test_node");
        
        // Node mit öffentlichem Schlüssel und Einsatz registrieren
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        
        // Beispielwert für voteId
        const voteId = 0;
        
        // Importiertes Zertifikat ausführen
        const tx = await certificateCore.connect(addr1).executeImportCertificate(voteId);
        
        // Prüfen, ob das ActionLogged-Event ausgelöst wird
        await expect(tx).to.emit(loggingManager, "ActionLogged");
    });

    // Testfall: Prüft die Signatur einer Nachricht
    it("sollte eine Nachrichtensignatur verifizieren", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);

        // Testnachricht signieren und verifizieren
        const message = ethers.toUtf8Bytes("test_message");
        const messageHash = ethers.keccak256(message);
        const signature = await addr2.signMessage(ethers.getBytes(messageHash));
        const isValid = await certificateCore.verifyMessageSignature(certHash, messageHash, signature);
        expect(isValid).to.equal(true);
    });

    // Testfall: Ruft den Algorithmus eines Zertifikats ab
    it("sollte den Algorithmus eines Zertifikats abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und Algorithmus prüfen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const retrievedAlgorithm = await certificateCore.getAlgorithm(certHash);
        expect(retrievedAlgorithm).to.equal(algorithm);
    });

    // Testfall: Ruft den Namen des Algorithmus eines Zertifikats ab
    it("sollte den Namen des Algorithmus eines Zertifikats abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und Algorithmusnamen prüfen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        const algorithmName = await certificateCore.getAlgorithmName(certHash);
        expect(algorithmName).to.equal("ECDSA");
    });

    // Testfall: Prüft, ob ein Zertifikat in der CRL ist
    it("sollte prüfen, ob ein Zertifikat in der CRL enthalten ist", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen, widerrufen und CRL-Status prüfen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).revokeCertificate(certHash);
        const isInCRL = await certificateCore.isCertificateInCRL(certHash);
        expect(isInCRL).to.equal(true);
    });

    // Testfall: Prüft die Mindestanzahl an Signaturen
    it("sollte prüfen, ob ein Zertifikat genügend Signaturen hat", async function () {
        await trustManager.addCA(addr1.address);
        await trustManager.addCA(addr3.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "bytes", "uint256", "uint256", "uint8"],
                [addr1.address, addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Zertifikat ausstellen und Mitunterzeichner hinzufügen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey, validFrom, validTo, algorithm);
        await certificateCore.connect(addr3).coSignCertificate(certHash);

        // Prüfen, ob das Zertifikat genügend Signaturen hat (Minimum 1)
        const hasEnough = await certificateCore.hasEnoughSignatures(certHash, 1);
        expect(hasEnough).to.equal(true);
    });

    // Testfall: Ruft die PEM-Daten eines importierten Zertifikats ab
    it("sollte die PEM-Daten eines Zertifikats abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA
        const pemData = ethers.toUtf8Bytes("-----BEGIN CERTIFICATE-----\nMII...");
        const voteId = 0; // Beispiel-Vote-ID

        // Externes Zertifikat importieren
        await certificateCore.connect(addr1).importExternalCertificate(
            addr2.address,
            publicKey,
            validFrom,
            validTo,
            algorithm,
            pemData,
            voteId
        );

        // Zertifikat-Hash generieren
        const certHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "bytes", "uint256", "uint256", "uint8"],
                [addr2.address, publicKey, validFrom, validTo, algorithm]
            )
        );

        // Abgerufene PEM-Daten prüfen
        const retrievedPem = await certificateCore.getPEM(certHash);
        expect(retrievedPem).to.equal(ethers.hexlify(pemData));
    });

    // Testfall: Ruft alle Zertifikate in einem Bereich ab
    it("sollte alle Zertifikate abrufen", async function () {
        await trustManager.addCA(addr1.address);
        const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
        const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
        const validFrom = Math.floor(Date.now() / 1000);
        const validTo = validFrom + 1000000;
        const algorithm = 0; // ECDSA

        // Zwei Zertifikate ausstellen
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey1, validFrom, validTo, algorithm);
        await certificateCore.connect(addr1).issueCertificate(addr2.address, publicKey2, validFrom, validTo, algorithm);

        // Alle Zertifikate abrufen (Bereich 0 bis 1)
        const allCerts = await certificateCore.getAllCertificates(0, 1);
        expect(allCerts.length).to.equal(2);
    });
});