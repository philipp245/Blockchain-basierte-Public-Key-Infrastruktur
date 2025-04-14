// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Interface zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Definiert die Schnittstelle für den TrustManager, der Vertrauen zwischen CAs und Entitäten regelt.

pragma solidity ^0.8.21;

interface ITrustManager {
    function setTrustLevel(address _entity, uint8 _level) external;
    function delegateTrust(address _entity) external;
    function revokeTrust(address _entity) external;
    function isTrusted(address _entity) external view returns (bool);
    function getRootCA(address _entity) external view returns (address);
    function getDelegatedEntities(address _issuer) external view returns (address[] memory);
    function addCA(address _ca) external;
    function voteToBlacklistCA(address _targetCA) external;
    function getVotesAgainstCA(address _ca) external view returns (address[] memory);
    function isCABlacklisted(address _ca) external view returns (bool);
    function isCA(address _entity) external view returns (bool);
    function setTrustedTime(uint256 _time) external;
    function getCurrentTime() external view returns (uint256);
}