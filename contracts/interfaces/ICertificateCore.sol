// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Interface zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Definiert die Schnittstelle für den CertificateCore, der den Zertifikatslebenszyklus verwaltet.

pragma solidity ^0.8.21;

interface ICertificateCore {
    enum SignatureAlgorithm { ECDSA, XMSS, SPHINCS, DILITHIUM, FALCON, CUSTOM }

    struct CertificateTransaction {
        string txType;
        uint256 timestamp;
        address issuer;
        address subject;
        uint256 validFrom;
        uint256 validTo;
    }

    function issueCertificate(
        address _subject,
        bytes memory _publicKey,
        uint256 _validFrom,
        uint256 _validTo,
        SignatureAlgorithm _algorithm
    ) external;

    function revokeCertificate(bytes32 _certHash) external;
    function authenticate(bytes32 _certHash, bytes memory _signature, bytes32 _nonce) external view returns (bool);
    function renewCertificate(bytes32 _certHash, uint256 _newValidTo, bytes memory _signature) external;
    function getCertificate(bytes32 _certHash) external view returns (
        address issuer, address subject, bytes memory publicKey,
        uint256 validFrom, uint256 validTo, bool revoked, SignatureAlgorithm algorithm
    );
    function coSignCertificate(bytes32 _certHash) external;
    function isCertificateValid(bytes32 _certHash) external view returns (bool);
    function getCosigners(bytes32 _certHash) external view returns (address[] memory);
    function verifyCertificateSignature(bytes32 _certHash, bytes32 _dataHash, bytes memory _signature) external view returns (bool);
    function getCertificateHistory(bytes32 _certHash) external view returns (CertificateTransaction[] memory);
    function getCertificatesBySubject(address _subject) external view returns (bytes32[] memory);
    function updateCertificatePublicKey(bytes32 _certHash, bytes memory _newPublicKey) external;
    function importExternalCertificate(
        address _subject,
        bytes memory _publicKey,
        uint256 _validFrom,
        uint256 _validTo,
        SignatureAlgorithm _algorithm,
        bytes memory _pemData,
        uint256 _voteId
    ) external;
    function executeImportCertificate(uint256 _voteId) external;
    function verifyMessageSignature(bytes32 _certHash, bytes32 _messageHash, bytes memory _signature) external view returns (bool);
    function getAlgorithm(bytes32 _certHash) external view returns (SignatureAlgorithm);
    function getAlgorithmName(bytes32 _certHash) external view returns (string memory);
    function isCertificateInCRL(bytes32 _certHash) external view returns (bool);
    function hasEnoughSignatures(bytes32 _certHash, uint256 minSigners) external view returns (bool);
    function getPEM(bytes32 _certHash) external view returns (bytes memory);
}