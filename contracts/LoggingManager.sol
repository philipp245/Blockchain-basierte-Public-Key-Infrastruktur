// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Einer von 5 Smart Contracts zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Dient als zentrales Protokollierungssystem für wichtige Aktionen innerhalb der anderen Contracts zur Gewährleistung von Transparenz und Nachvollziehbarkeit.

pragma solidity ^0.8.21;

// Der LoggingManager-Contract protokolliert Aktionen im System.
contract LoggingManager {
    // Struktur für einen Protokolleintrag.
    struct ActionLog {
        address actor;      // Adresse des Ausführenden
        bytes32 actionHash; // Hash der ausgeführten Aktion
        uint256 timestamp;  // Zeitstempel der Aktion
    }

    // Verknüpft Adressen mit ihren Protokolleinträgen.
    mapping(address => ActionLog[]) public actionLogs;
    mapping(address => bool) public isAuthorized; 

    // Event zur Protokollierung einer Aktion.
    event ActionLogged(address indexed actor, bytes32 indexed actionHash, uint256 timestamp);

    modifier onlyAuthorized() {
        require(isAuthorized[msg.sender], "Nur autorisierte Entitaeten");
        _;
    }

    constructor() {
        isAuthorized[msg.sender] = true; 
    }

    // Funktion zum Protokollieren einer Aktion.
    function logAction(address _actor, bytes32 _actionHash) public onlyAuthorized {
        actionLogs[_actor].push(ActionLog({
            actor: _actor,
            actionHash: _actionHash,
            timestamp: block.timestamp
        }));
        emit ActionLogged(_actor, _actionHash, block.timestamp);
    }

    function addAuthorized(address _address) public onlyAuthorized {
        require(!isAuthorized[_address], "Adresse bereits autorisiert");
        isAuthorized[_address] = true;
    }

    // Funktion zum Abrufen aller Action-Hashes einer Adresse.
    function getActionHashes(address _actor) public view returns (bytes32[] memory) {
        ActionLog[] storage logs = actionLogs[_actor];
        bytes32[] memory actionHashes = new bytes32[](logs.length);
        for (uint256 i = 0; i < logs.length; i++) {
            actionHashes[i] = logs[i].actionHash;
        }
        return actionHashes;
    }
}
