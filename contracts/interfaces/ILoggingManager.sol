// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Interface zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Definiert die Schnittstelle für den LoggingManager, der Aktionen protokolliert.

pragma solidity ^0.8.21;

interface ILoggingManager {
    function logAction(address _actor, bytes32 _actionHash) external;
    function getActionHashes(address _actor) external view returns (bytes32[] memory);
}