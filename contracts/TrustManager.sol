// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Einer von 5 Smart Contracts zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Verwaltet die Liste der autorisierten CAs, delegiertes Vertrauen und stellt potenziell eine vertrauenswürdige Zeitinformation bereit

pragma solidity ^0.8.21;

import "./interfaces/ILoggingManager.sol";

// Der TrustManager-Vertrag verwaltet das Vertrauen zwischen CAs und Entitäten im System.
contract TrustManager {
    // Speichert, ob eine Adresse eine anerkannte CA ist.
    mapping(address => bool) public isCA;
    // Verknüpft Entitäten mit der Adresse, die ihnen Vertrauen delegiert hat.
    mapping(address => address) public trustedBy;
    // Speichert das Vertrauenslevel (1-10) jeder Entität.
    mapping(address => uint8) public trustLevels;
    // Liste von Stimmen gegen eine CA (für Blacklisting).
    mapping(address => address[]) public votesAgainstCA;
    // Liste von Entitäten, denen eine Adresse Vertrauen delegiert hat.
    mapping(address => address[]) public delegatedEntities;
    // Zählt die Anzahl der CAs im System.
    uint256 public caCount;
    // Adresse des Zeit-Orakels, das die vertrauenswürdige Zeit setzen kann.
    address public timeOracle;
    // Vertrauenswürdige Zeit (falls gesetzt, sonst Blockzeit).
    uint256 public trustedTime;
    // Schnittstelle zum LoggingManager für Protokollierung.
    ILoggingManager public loggingManager;

    // Events zur Protokollierung wichtiger Aktionen.
    event CAAdded(address indexed addedCA, address indexed addedBy);         // Neue CA wurde hinzugefügt
    event TrustDelegated(address indexed fromCA, address indexed toEntity); // Vertrauen wurde delegiert
    event TrustRevoked(address indexed entity, address indexed revokedBy);  // Vertrauen wurde widerrufen

    // Konstruktor: Setzt den Deployer als erste CA und Zeit-Orakel.
    constructor(address _loggingManager) {
        isCA[msg.sender] = true;
        trustLevels[msg.sender] = 10; // Setze trustLevel für die initiale CA auf 10
        timeOracle = msg.sender;
        caCount = 1;
        loggingManager = ILoggingManager(_loggingManager);
    }

    // Modifikator: Beschränkt Zugriff auf CAs.
    modifier onlyCA() {
        require(isCA[msg.sender], "Nur eine CA kann diese Funktion ausfuehren");
        _;
    }

    // Modifikator: Beschränkt Zugriff auf das Zeit-Orakel.
    modifier onlyOracle() {
        require(msg.sender == timeOracle, "Nur das autorisierte Zeit-Oracle darf das setzen");
        _;
    }

    // Funktion zum Hinzufügen einer neuen CA durch eine existierende CA.
    function addCA(address _ca) public onlyCA {
        require(_ca != address(0), "Ungueltige Adresse");
        require(!isCA[_ca], "Bereits eine CA");
        isCA[_ca] = true;
        caCount++;
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("addCA", _ca)));
        emit CAAdded(_ca, msg.sender);
    }

    // Funktion zum Setzen des Vertrauenslevels einer Entität durch eine CA.
    function setTrustLevel(address _entity, uint8 _level) public onlyCA {
        require(_entity != address(0), "Ungueltige Adresse");
        require(_level > 0 && _level <= 10, "Ungueltiges Level (1-10)");
        if (trustLevels[_entity] > 0) {
            require(_level <= trustLevels[trustedBy[_entity]], "Level darf nicht hoeher als Issuer sein");
        }
        trustLevels[_entity] = _level;
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("setTrustLevel", _entity, _level)));
    }

    // Funktion zum Delegieren von Vertrauen an eine Entität.
    function delegateTrust(address _entity) public {
        require(_entity != address(0), "Ungueltige Adresse");
        require(trustedBy[_entity] == address(0), "Entitaet wurde bereits zertifiziert");
        require(trustLevels[msg.sender] > 1, "Nur Entitaeten mit Level > 1 koennen delegieren");

        // Prüft auf Zyklen in der Vertrauenskette (max. 10 Ebenen).
        address current = msg.sender;
        for (uint8 i = 0; i < 10; i++) {
            require(current != _entity, "Zyklus in der Vertrauenskette erkannt");
            current = trustedBy[current];
            if (current == address(0)) break;
        }

        // Delegiert Vertrauen und setzt das Level der Entität.
        trustedBy[_entity] = msg.sender;
        delegatedEntities[msg.sender].push(_entity);
        uint8 issuerLevel = trustLevels[msg.sender];
        trustLevels[_entity] = issuerLevel - 1;

        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("delegateTrust", _entity)));
        emit TrustDelegated(msg.sender, _entity);
    }

    // Funktion zum Widerrufen von Vertrauen durch den Delegierenden.
    function revokeTrust(address _entity) public {
        require(trustedBy[_entity] != address(0), "Entitaet hat kein Trust-Eintrag");
        require(trustedBy[_entity] == msg.sender, "Nur der ausstellende CA darf widerrufen");

        delete trustedBy[_entity];
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("revokeTrust", _entity)));
        emit TrustRevoked(_entity, msg.sender);
    }

    // Funktion zur Prüfung, ob eine Entität vertrauenswürdig ist (Verbindung zu einer CA).
    function isTrusted(address _entity) public view returns (bool) {
        address current = _entity;
        for (uint8 i = 0; i < 10; i++) {
            address issuer = trustedBy[current];
            if (issuer == address(0)) return false;
            if (isCA[issuer]) return true;
            current = issuer;
        }
        return false;
    }

    // Funktion zum Abrufen der Root-CA einer Entität.
    function getRootCA(address _entity) public view returns (address) {
        address current = _entity;
        address rootCA = address(0);
        for (uint8 i = 0; i < 10; i++) {
            address issuer = trustedBy[current];
            if (issuer == address(0)) break;
            if (isCA[issuer]) {
                rootCA = issuer;
                break;
            }
            current = issuer;
        }
        return rootCA;
    }

    // Funktion zum Abrufen der delegierten Entitäten einer Adresse.
    function getDelegatedEntities(address _issuer) public view returns (address[] memory) {
        return delegatedEntities[_issuer];
    }

    // Funktion zum Abstimmen über das Blacklisten einer CA.
    function voteToBlacklistCA(address _targetCA) public onlyCA {
        require(_targetCA != address(0), "Ungueltige Adresse");
        require(isCA[_targetCA], "Ziel ist keine CA");

        // Prüft, ob die CA bereits abgestimmt hat.
        address[] storage votes = votesAgainstCA[_targetCA];
        for (uint256 i = 0; i < votes.length; i++) {
            require(votes[i] != msg.sender, "Du hast bereits abgestimmt");
        }

        votes.push(msg.sender);
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("voteToBlacklistCA", _targetCA)));
    }

    // Funktion zum Abrufen der Stimmen gegen eine CA.
    function getVotesAgainstCA(address _ca) public view returns (address[] memory) {
        return votesAgainstCA[_ca];
    }

    // Funktion zur Prüfung, ob eine CA auf der Blacklist steht (Mehrheit der Stimmen).
    function isCABlacklisted(address _ca) public view returns (bool) {
        address[] memory votes = votesAgainstCA[_ca];
        return votes.length >= caCount / 2;
    }

    // Funktion zum Setzen der vertrauenswürdigen Zeit durch das Orakel.
    function setTrustedTime(uint256 _time) public onlyOracle {
        trustedTime = _time;
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("setTrustedTime", _time)));
    }

    // Funktion zum Abrufen der aktuellen Zeit (vertrauenswürdig oder Blockzeit).
    function getCurrentTime() public view returns (uint256) {
        return trustedTime == 0 ? block.timestamp : trustedTime;
    }
}