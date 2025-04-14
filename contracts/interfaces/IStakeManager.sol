// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Interface zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Definiert die Schnittstelle für den StakeManager, der die Einsätze der Nodes verwaltet.

pragma solidity ^0.8.21;

interface IStakeManager {
    function registerNode(bytes memory _publicKey) external payable;
    function withdrawStake() external;
    function slashNode(address _node, uint256 _slashAmount) external;
    function getTotalStake() external view returns (uint256);
    function addToRewardPool() external payable;
    function distributeRewards(uint256 _voteId) external;
    function getStake(address _node) external view returns (uint256);
    function isRegisteredNode(address _node) external view returns (bool);
}