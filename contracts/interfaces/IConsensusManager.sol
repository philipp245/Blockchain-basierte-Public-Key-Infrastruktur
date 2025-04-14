// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Interface zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Definiert die Schnittstelle für den ConsensusManager, der Abstimmungen koordiniert.   

pragma solidity ^0.8.21;

interface IConsensusManager {
    // Funktionen für Konsensabstimmungen
    function createConsensusVote(bytes32 _actionHash) external;
    function voteOnConsensus(uint256 _voteId, bool _inFavor) external;
    function getVotersForVote(uint256 _voteId) external view returns (address[] memory);
    function executeVote(uint256 _voteId) external; // Neu hinzugefügt
    function isVoteExecuted(uint256 _voteId) external view returns (bool);
    function getVoteResult(uint256 _voteId) external view returns (bool);

    // Funktionen für Vorschläge
    function createProposal(bytes32 _proposalHash, string memory _description) external;
    function voteOnProposal(uint256 _proposalId, bool _inFavor) external;
    function getProposal(uint256 _proposalId) external view returns (
        bytes32 proposalHash,
        string memory description,
        uint256 stakeFor,
        uint256 stakeAgainst,
        bool executed,
        address proposer
    );

    // Getter für öffentliche Variablen
    function voteCounter() external view returns (uint256);
    function proposalCounter() external view returns (uint256);
}