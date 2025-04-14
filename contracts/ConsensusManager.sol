// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Einer von 5 Smart Contracts zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Koordiniert Abstimmungsprozesse auf Anwendungsebene unter den registrierten Nodes mittels Stake-gewichteter Abstimmungen.

pragma solidity ^0.8.21;

import "./interfaces/IStakeManager.sol";
import "./interfaces/ILoggingManager.sol";

// Der ConsensusManager-Vertrag verwaltet Abstimmungen und Vorschläge im System.
contract ConsensusManager {
    // Struktur für eine Konsensabstimmung.
    struct ConsensusVote {
        bytes32 actionHash;         // Hash der Aktion, über die abgestimmt wird
        uint256 stakeFor;           // Gesamteinsatz der Befürworter
        uint256 stakeAgainst;       // Gesamteinsatz der Gegner
        mapping(address => bool) hasVoted; // Wer hat bereits abgestimmt?
        bool executed;              // Wurde die Abstimmung ausgeführt?
        address[] voters;           // Liste der Wähler
    }

    // Struktur für einen Vorschlag.
    struct Proposal {
        bytes32 proposalHash;       // Hash des Vorschlags
        string description;         // Beschreibung des Vorschlags
        uint256 stakeFor;           // Gesamteinsatz der Befürworter
        uint256 stakeAgainst;       // Gesamteinsatz der Gegner
        bool executed;              // Wurde der Vorschlag ausgeführt?
        address proposer;           // Adresse des Vorschlagenden
        mapping(address => bool) hasVoted; // Wer hat bereits abgestimmt?
    }

    // Speichert Abstimmungen und Vorschläge anhand ihrer IDs.
    mapping(uint256 => ConsensusVote) public consensusVotes;
    mapping(uint256 => Proposal) public proposals;
    // Zähler für Abstimmungen und Vorschläge.
    uint256 public voteCounter;
    uint256 public proposalCounter;
    // Schnittstellen zu Stake- und Logging-Verträgen.
    IStakeManager public stakeManager;
    ILoggingManager public loggingManager;

    // Events zur Protokollierung wichtiger Aktionen.
    event ConsensusVoteCreated(uint256 indexed voteId, bytes32 indexed actionHash); // Abstimmung wurde erstellt
    event ConsensusVoteCast(uint256 indexed voteId, address indexed voter, bool inFavor, uint256 stake); // Stimme wurde abgegeben
    event ProposalCreated(uint256 indexed proposalId, bytes32 indexed proposalHash, address indexed proposer); // Vorschlag wurde erstellt
    event ProposalVoted(uint256 indexed proposalId, address indexed voter, bool inFavor); // Abstimmung über Vorschlag

    // Konstruktor: Initialisiert die Schnittstellen.
    constructor(address _stakeManager, address _loggingManager) {
        stakeManager = IStakeManager(_stakeManager);
        loggingManager = ILoggingManager(_loggingManager);
    }

    // Modifikator: Beschränkt Zugriff auf registrierte Nodes.
    modifier onlyRegisteredNode() {
        require(stakeManager.isRegisteredNode(msg.sender), "Nur registrierte Nodes koennen diese Funktion ausfuehren");
        _;
    }

    // Funktion zum Erstellen einer neuen Konsensabstimmung.
    function createConsensusVote(bytes32 _actionHash) public onlyRegisteredNode {
        ConsensusVote storage vote = consensusVotes[voteCounter];
        vote.actionHash = _actionHash;
        vote.stakeFor = 0;
        vote.stakeAgainst = 0;
        vote.executed = false;
        vote.voters = new address[](0);

        emit ConsensusVoteCreated(voteCounter, _actionHash);
        voteCounter++;
    }

    // Funktion zum Abstimmen über eine Konsensabstimmung.
    function voteOnConsensus(uint256 _voteId, bool _inFavor) public onlyRegisteredNode {
        require(_voteId < voteCounter, "Ungueltige Abstimmungs-ID");
        ConsensusVote storage vote = consensusVotes[_voteId];
        require(!vote.executed, "Abstimmung bereits ausgefuehrt");
        require(!vote.hasVoted[msg.sender], "Du hast bereits abgestimmt");

        uint256 voterStake = stakeManager.getStake(msg.sender);
        require(voterStake > 0, "Kein Stake vorhanden");

        // Registriert die Stimme und aktualisiert den Einsatz.
        vote.hasVoted[msg.sender] = true;
        vote.voters.push(msg.sender);

        if (_inFavor) {
            vote.stakeFor += voterStake;
        } else {
            vote.stakeAgainst += voterStake;
        }

        emit ConsensusVoteCast(_voteId, msg.sender, _inFavor, voterStake);
    }

    // Funktion zum Abrufen der Wähler einer Abstimmung.
    function getVotersForVote(uint256 _voteId) public view returns (address[] memory) {
        require(_voteId < voteCounter, "Ungueltige Abstimmungs-ID");
        return consensusVotes[_voteId].voters;
    }

    // Funktion zum Erstellen eines neuen Vorschlags.
    function createProposal(bytes32 _proposalHash, string memory _description) public onlyRegisteredNode {
        Proposal storage proposal = proposals[proposalCounter];
        proposal.proposalHash = _proposalHash;
        proposal.description = _description;
        proposal.stakeFor = 0;
        proposal.stakeAgainst = 0;
        proposal.executed = false;
        proposal.proposer = msg.sender;

        emit ProposalCreated(proposalCounter, _proposalHash, msg.sender);
        proposalCounter++;
    }

    // Funktion zum Abstimmen über einen Vorschlag.
    function voteOnProposal(uint256 _proposalId, bool _inFavor) public onlyRegisteredNode {
        require(_proposalId < proposalCounter, "Ungueltige Proposal-ID");
        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.executed, "Proposal bereits ausgefuehrt");
        require(!proposal.hasVoted[msg.sender], "Du hast bereits abgestimmt");

        uint256 voterStake = stakeManager.getStake(msg.sender);
        require(voterStake > 0, "Kein Stake vorhanden");

        // Registriert die Stimme und aktualisiert den Einsatz.
        proposal.hasVoted[msg.sender] = true;
        if (_inFavor) {
            proposal.stakeFor += voterStake;
        } else {
            proposal.stakeAgainst += voterStake;
        }

        emit ProposalVoted(_proposalId, msg.sender, _inFavor);
    }

    // Funktion zum Abrufen der Details eines Vorschlags.
    function getProposal(uint256 _proposalId) public view returns (
        bytes32 proposalHash,
        string memory description,
        uint256 stakeFor,
        uint256 stakeAgainst,
        bool executed,
        address proposer
    ) {
        require(_proposalId < proposalCounter, "Ungueltige Proposal-ID");
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.proposalHash,
            proposal.description,
            proposal.stakeFor,
            proposal.stakeAgainst,
            proposal.executed,
            proposal.proposer
        );
    }

    function executeVote(uint256 _voteId) public onlyRegisteredNode {
        require(_voteId < voteCounter, "Ungueltige Abstimmungs-ID");
        ConsensusVote storage vote = consensusVotes[_voteId];
        require(!vote.executed, "Abstimmung bereits ausgefuehrt");
        vote.executed = true;
    }

    // Funktion zur Prüfung, ob eine Abstimmung ausgeführt wurde.
    function isVoteExecuted(uint256 _voteId) public view returns (bool) {
        require(_voteId < voteCounter, "Ungueltige Abstimmungs-ID");
        return consensusVotes[_voteId].executed;
    }

    // Funktion zum Abrufen des Ergebnisses einer Abstimmung (true, wenn mehr für als gegen).
    function getVoteResult(uint256 _voteId) public view returns (bool) {
        require(_voteId < voteCounter, "Ungueltige Abstimmungs-ID");
        ConsensusVote storage vote = consensusVotes[_voteId];
        return vote.stakeFor > vote.stakeAgainst;
    }
}