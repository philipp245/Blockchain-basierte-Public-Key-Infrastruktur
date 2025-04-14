// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Einer von 5 Smart Contracts zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Zuständig für den gesamten Lebenszyklus von Zertifikaten (Ausstellung, Widerruf, Erneuerung, Validierung, Speicherung). Fungiert als dezentrales Zertifikatsverzeichnis.


pragma solidity ^0.8.21;

import "./interfaces/ITrustManager.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/ILoggingManager.sol";

// Der CertificateCore-Vertrag verwaltet Zertifikate, die von Certificate Authorities (CAs) ausgestellt werden.
contract CertificateCore {
    // Enum für verschiedene Signaturalgorithmen, die ein Zertifikat verwenden kann.
    enum SignatureAlgorithm { ECDSA, XMSS, SPHINCS, DILITHIUM, FALCON, CUSTOM }

    // Struktur für ein Zertifikat mit allen wichtigen Informationen.
    struct Certificate {
        address issuer;            // Adresse der ausstellenden CA
        address subject;           // Adresse des Zertifikatsinhabers
        bytes publicKey;           // Öffentlicher Schlüssel des Zertifikatsinhabers
        uint256 validFrom;         // Zeitpunkt, ab dem das Zertifikat gültig ist
        uint256 validTo;           // Zeitpunkt, bis zu dem das Zertifikat gültig ist
        bool revoked;              // Gibt an, ob das Zertifikat widerrufen wurde
        SignatureAlgorithm algorithm; // Verwendeter Signaturalgorithmus
    }

    // Struktur für eine Transaktion im Lebenszyklus eines Zertifikats (z. B. Ausstellung, Widerruf).
    struct CertificateTransaction {
        string txType;             // Typ der Transaktion (z. B. "issue", "revoke")
        uint256 timestamp;         // Zeitstempel der Transaktion
        address issuer;            // Aussteller der Transaktion
        address subject;           // Inhaber des Zertifikats
        uint256 validFrom;         // Start der Gültigkeit
        uint256 validTo;           // Ende der Gültigkeit
    }

    // Speichert Zertifikate anhand ihres Hash-Werts.
    mapping(bytes32 => Certificate) public certificates;
    // Liste von Mitunterzeichnern (Co-Signers) für jedes Zertifikat.
    mapping(bytes32 => address[]) public certSigners;
    // Historie der Transaktionen für jedes Zertifikat.
    mapping(bytes32 => CertificateTransaction[]) public certificateHistory;
    // Verknüpft Subjects mit ihren Zertifikat-Hashes.
    mapping(address => bytes32[]) public subjectToCertificates;
    // Liste aller Zertifikat-Hashes im System.
    bytes32[] public allCertificateHashes;
    // Speichert den Widerrufszeitpunkt für widerrufene Zertifikate.
    mapping(bytes32 => uint256) public revokedCertificates;
    // Speichert PEM-Daten für importierte Zertifikate.
    mapping(bytes32 => bytes) public certificatePEM;

    // Schnittstellen zu anderen Verträgen für Vertrauen, Einsätze und Protokollierung.
    ITrustManager public trustManager;
    IStakeManager public stakeManager;
    ILoggingManager public loggingManager;

    // Events zur Protokollierung wichtiger Aktionen.
    event CertificateIssued(bytes32 indexed certHash, address issuer, address subject);      // Zertifikat wurde ausgestellt
    event CertificateRevoked(bytes32 indexed certHash, uint256 revocationTime);             // Zertifikat wurde widerrufen
    event CertificateRenewed(bytes32 indexed certHash, uint256 newValidTo);                 // Zertifikat wurde erneuert
    event CertificateCoSigned(bytes32 indexed certHash, address indexed coSigner);          // Zertifikat wurde mitunterzeichnet

    // Konstruktor: Initialisiert die Schnittstellen zu anderen Verträgen.
    constructor(address _trustManager, address _stakeManager, address _loggingManager) {
        trustManager = ITrustManager(_trustManager);
        stakeManager = IStakeManager(_stakeManager);
        loggingManager = ILoggingManager(_loggingManager);
    }

    // Modifikator: Beschränkt den Zugriff auf anerkannte Certificate Authorities (CAs).
    modifier onlyCA() {
        require(trustManager.isCA(msg.sender), "Nur eine CA kann diese Funktion ausfuehren");
        _;
    }

    // Modifikator: Beschränkt den Zugriff auf registrierte Nodes.
    modifier onlyRegisteredNode() {
        require(stakeManager.isRegisteredNode(msg.sender), "Nur registrierte Nodes koennen diese Funktion ausfuehren");
        _;
    }

    // Funktion zum Ausstellen eines neuen Zertifikats durch eine CA.
    function issueCertificate(
        address _subject,              // Adresse des Zertifikatsinhabers
        bytes memory _publicKey,       // Öffentlicher Schlüssel des Subjects
        uint256 _validFrom,            // Startzeitpunkt der Gültigkeit
        uint256 _validTo,              // Endzeitpunkt der Gültigkeit
        SignatureAlgorithm _algorithm  // Zu verwendender Algorithmus
    ) public onlyCA {
        // Erstellt einen eindeutigen Hash für das Zertifikat.
        bytes32 certHash = keccak256(abi.encodePacked(msg.sender, _subject, _publicKey, _validFrom, _validTo, _algorithm));
        require(certificates[certHash].issuer == address(0), "Zertifikat existiert bereits");
        require(_validFrom < _validTo, "Ungueltige Gueltigkeitsdauer");  // Neue Validierung

        // Speichert das neue Zertifikat in der Mapping-Struktur.
        certificates[certHash] = Certificate({
            issuer: msg.sender,
            subject: _subject,
            publicKey: _publicKey,
            validFrom: _validFrom,
            validTo: _validTo,
            revoked: false,
            algorithm: _algorithm
        });

        // Fügt die Ausstellung zur Historie des Zertifikats hinzu.
        certificateHistory[certHash].push(CertificateTransaction({
            txType: "issue",
            timestamp: trustManager.getCurrentTime(),
            issuer: msg.sender,
            subject: _subject,
            validFrom: _validFrom,
            validTo: _validTo
        }));

        // Verknüpft das Zertifikat mit dem Subject und fügt es zur Gesamtliste hinzu.
        subjectToCertificates[_subject].push(certHash);
        allCertificateHashes.push(certHash);

        // Protokolliert die Aktion und löst das Event aus.
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("issue", certHash)));
        emit CertificateIssued(certHash, msg.sender, _subject);
    }

    // Funktion zum Widerrufen eines Zertifikats durch die ausstellende CA.
    function revokeCertificate(bytes32 _certHash) public onlyCA {
        Certificate storage cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        require(!cert.revoked, "Zertifikat bereits widerrufen");
        require(cert.issuer == msg.sender, "Nur der Aussteller kann widerrufen");

        // Markiert das Zertifikat als widerrufen und speichert den Zeitpunkt.
        cert.revoked = true;
        revokedCertificates[_certHash] = trustManager.getCurrentTime();

        // Fügt den Widerruf zur Historie hinzu.
        certificateHistory[_certHash].push(CertificateTransaction({
            txType: "revoke",
            timestamp: trustManager.getCurrentTime(),
            issuer: cert.issuer,
            subject: cert.subject,
            validFrom: cert.validFrom,
            validTo: cert.validTo
        }));

        // Protokolliert die Aktion und löst das Event aus.
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("revoke", _certHash)));
        emit CertificateRevoked(_certHash, trustManager.getCurrentTime());
    }

    // Funktion zur Authentifizierung eines Subjects anhand eines Zertifikats und einer Signatur.
    function authenticate(bytes32 _certHash, bytes memory _signature, bytes32 _nonce) public view returns (bool) {
        Certificate memory cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        require(!cert.revoked, "Zertifikat ist widerrufen");
        require(trustManager.getCurrentTime() >= cert.validFrom && trustManager.getCurrentTime() <= cert.validTo, "Zertifikat ist ungueltig");

        // Erstellt einen Hash aus Nonce und Subject-Adresse, um die Signatur zu prüfen.
        bytes32 messageHash = keccak256(abi.encodePacked(_nonce, cert.subject));
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address recovered = recoverSigner(prefixedHash, _signature);
        return recovered == cert.subject; // True, wenn die Signatur vom Subject stammt.
    }

    // Funktion zum Erneuern eines Zertifikats durch die ausstellende CA.
    function renewCertificate(bytes32 _certHash, uint256 _newValidTo, bytes memory _signature) public onlyCA {
        Certificate storage cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        require(cert.issuer == msg.sender, "Nur der Aussteller kann erneuern");
        require(!cert.revoked, "Zertifikat ist widerrufen");
        require(_newValidTo > cert.validTo, "Neuer Gueltigkeitszeitraum muss laenger sein");

        // Überprüft die Signatur der CA.
        bytes32 dataHash = keccak256(abi.encodePacked(_certHash));
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        require(verifySignature(prefixedHash, _signature, msg.sender), "Ungueltige Signatur");

        // Aktualisiert die Gültigkeit und fügt die Erneuerung zur Historie hinzu.
        cert.validTo = _newValidTo;
        certificateHistory[_certHash].push(CertificateTransaction({
            txType: "renew",
            timestamp: trustManager.getCurrentTime(),
            issuer: msg.sender,
            subject: cert.subject,
            validFrom: cert.validFrom,
            validTo: _newValidTo
        }));
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("renew", _certHash)));
        emit CertificateRenewed(_certHash, _newValidTo);
    }

    // Funktion zum Abrufen der Details eines Zertifikats.
    function getCertificate(bytes32 _certHash) public view returns (
        address issuer, address subject, bytes memory publicKey,
        uint256 validFrom, uint256 validTo, bool revoked, SignatureAlgorithm algorithm
    ) {
        Certificate memory cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        return (cert.issuer, cert.subject, cert.publicKey, cert.validFrom, cert.validTo, cert.revoked, cert.algorithm);
    }

    // Funktion zum Mitunterzeichnen eines Zertifikats durch eine andere CA.
    function coSignCertificate(bytes32 _certHash) public onlyCA {
        require(trustManager.isCA(msg.sender), "Nur eine CA kann co-signieren");
        require(certificates[_certHash].issuer != address(0), "Zertifikat existiert nicht");
        require(!certificates[_certHash].revoked, "Zertifikat ist widerrufen");
        require(msg.sender != certificates[_certHash].issuer, "Issuer darf nicht cosignen");

        // Prüft, ob die CA bereits unterschrieben hat, und fügt sie hinzu.
        address[] storage signers = certSigners[_certHash];
        for (uint256 i = 0; i < signers.length; i++) {
            require(signers[i] != msg.sender, "Du hast bereits unterschrieben");
        }

        signers.push(msg.sender);
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("coSign", _certHash)));
        emit CertificateCoSigned(_certHash, msg.sender);
    }

    // Funktion zur Prüfung, ob ein Zertifikat aktuell gültig ist.
    function isCertificateValid(bytes32 _certHash) public view returns (bool) {
        Certificate memory cert = certificates[_certHash];
        if (cert.issuer == address(0)) return false; // Zertifikat existiert nicht
        if (cert.revoked) return false;              // Zertifikat wurde widerrufen
        uint256 currentTime = trustManager.getCurrentTime();
        return currentTime >= cert.validFrom && currentTime <= cert.validTo; // Gültigkeitszeitraum prüfen
    }

    // Fuktion zum Abrufen, ob ein Zertifikate revoked ist.
    function isRevoked(bytes32 _certHash) public view returns (bool) {
        return certificates[_certHash].revoked;
    }

    // Funktion zum Abrufen der Mitunterzeichner eines Zertifikats.
    function getCosigners(bytes32 _certHash) public view returns (address[] memory) {
        return certSigners[_certHash];
    }

    // Funktion zur Überprüfung einer Signatur basierend auf dem Zertifikat.
    function verifyCertificateSignature(bytes32 _certHash, bytes32 _dataHash, bytes memory _signature) public view returns (bool) {
        Certificate memory cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");

        // Nur ECDSA wird derzeit vollständig unterstützt.
        if (cert.algorithm == SignatureAlgorithm.ECDSA) {
            bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _dataHash));
            return verifySignature(prefixedHash, _signature, cert.subject);
        } else {
            return true; // Für andere Algorithmen wird vorerst immer "true" zurückgegeben
        }
    }

    // Funktion zum Abrufen der Historie eines Zertifikats.
    function getCertificateHistory(bytes32 _certHash) public view returns (CertificateTransaction[] memory) {
        return certificateHistory[_certHash];
    }

    // Funktion zum Abrufen aller Zertifikate eines Subjects.
    function getCertificatesBySubject(address _subject) public view returns (bytes32[] memory) {
        return subjectToCertificates[_subject];
    }

    // Funktion zum Aktualisieren des öffentlichen Schlüssels eines Zertifikats durch den Subject.
    function updateCertificatePublicKey(bytes32 _certHash, bytes memory _newPublicKey) public {
        Certificate storage cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        require(cert.subject == msg.sender, "Nur der Subject kann den Schluessel aktualisieren");
        require(!cert.revoked, "Zertifikat ist widerrufen");

        cert.publicKey = _newPublicKey; // Setzt den neuen Schlüssel
    }

    // Funktion zum Importieren eines externen Zertifikats durch eine CA.
    function importExternalCertificate(
        address _subject,
        bytes memory _publicKey,
        uint256 _validFrom,
        uint256 _validTo,
        SignatureAlgorithm _algorithm,
        bytes memory _pemData,
        uint256 _voteId
    ) public onlyCA {
        bytes32 certHash = keccak256(abi.encodePacked(_subject, _publicKey, _validFrom, _validTo, _algorithm));
        require(certificates[certHash].issuer == address(0), "Zertifikat existiert bereits");

        // Speichert das importierte Zertifikat.
        certificates[certHash] = Certificate({
            issuer: msg.sender,
            subject: _subject,
            publicKey: _publicKey,
            validFrom: _validFrom,
            validTo: _validTo,
            revoked: false,
            algorithm: _algorithm
        });

        certificatePEM[certHash] = _pemData; // Speichert die PEM-Daten
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("importExternalCertificate", certHash)));
    }

    // Funktion zum Ausführen eines Zertifikat-Imports durch eine CA und einen registrierten Node.
    function executeImportCertificate(uint256 _voteId) public onlyCA onlyRegisteredNode {
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("executeImportCertificate", _voteId)));
    }

    // Funktion zur Überprüfung einer Nachrichtensignatur basierend auf einem Zertifikat.
    function verifyMessageSignature(bytes32 _certHash, bytes32 _messageHash, bytes memory _signature) public view returns (bool) {
        Certificate memory cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        require(!cert.revoked, "Zertifikat ist widerrufen");
        require(trustManager.getCurrentTime() >= cert.validFrom && trustManager.getCurrentTime() <= cert.validTo, "Zertifikat ist ungueltig");

        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
        address recovered = recoverSigner(prefixedHash, _signature);
        return recovered == cert.subject; // True, wenn die Signatur vom Subject stammt
    }

    // Funktion zum Abrufen des Signaturalgorithmus eines Zertifikats.
    function getAlgorithm(bytes32 _certHash) public view returns (SignatureAlgorithm) {
        Certificate memory cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");
        return cert.algorithm;
    }

    // Funktion zum Abrufen des Namens des Signaturalgorithmus als String.
    function getAlgorithmName(bytes32 _certHash) public view returns (string memory) {
        Certificate memory cert = certificates[_certHash];
        require(cert.issuer != address(0), "Zertifikat existiert nicht");

        if (cert.algorithm == SignatureAlgorithm.ECDSA) return "ECDSA";
        if (cert.algorithm == SignatureAlgorithm.XMSS) return "XMSS";
        if (cert.algorithm == SignatureAlgorithm.SPHINCS) return "SPHINCS";
        if (cert.algorithm == SignatureAlgorithm.DILITHIUM) return "DILITHIUM";
        if (cert.algorithm == SignatureAlgorithm.FALCON) return "FALCON";
        if (cert.algorithm == SignatureAlgorithm.CUSTOM) return "CUSTOM";
        return "UNKNOWN"; // Falls kein bekannter Algorithmus
    }

    // Funktion zur Prüfung, ob ein Zertifikat auf der Widerrufsliste (CRL) steht.
    function isCertificateInCRL(bytes32 _certHash) public view returns (bool) {
        return revokedCertificates[_certHash] > 0; // True, wenn ein Widerrufszeitpunkt existiert
    }

    // Funktion zur Prüfung, ob ein Zertifikat genügend Mitunterzeichner hat.
    function hasEnoughSignatures(bytes32 _certHash, uint256 minSigners) public view returns (bool) {
        return certSigners[_certHash].length >= minSigners; // Vergleicht Anzahl der Signaturen mit Minimum
    }

    // Funktion zum Abrufen der PEM-Daten eines Zertifikats.
    function getPEM(bytes32 _certHash) public view returns (bytes memory) {
        require(certificates[_certHash].issuer != address(0), "Zertifikat existiert nicht");
        return certificatePEM[_certHash];
    }

    // Funktion zum Abrufen eines Bereichs aller Zertifikat-Hashes.
    function getAllCertificates(uint256 start, uint256 end) public view returns (bytes32[] memory) {
        require(start <= end && end < allCertificateHashes.length, "Ungueltige Indizes");
        uint256 length = end - start + 1;
        bytes32[] memory result = new bytes32[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = allCertificateHashes[start + i];
        }
        return result;
    }

    // Interne Funktion zum Wiederherstellen der Signatur-Adresse (ECDSA).
    function recoverSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        if (_signature.length != 65) return address(0); // Signatur muss 65 Bytes lang sein
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        if (v < 27) v += 27; // Normalisiert den v-Wert
        if (v != 27 && v != 28) return address(0); // Ungültiger v-Wert
        return ecrecover(_hash, v, r, s); // Stellt die Adresse wieder her
    }

    // Interne Funktion zur Überprüfung einer Signatur gegen eine Adresse.
    function verifySignature(bytes32 _dataHash, bytes memory _signature, address _signer) internal pure returns (bool) {
        return recoverSigner(_dataHash, _signature) == _signer; // True, wenn Signatur passt
    }
}