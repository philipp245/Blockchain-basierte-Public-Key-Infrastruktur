// Autor: Philipp Feil
// Datum: 03.04.2025
// Beschreibung: Einer von 5 Smart Contracts zur Umsetzung einer Blockchain Basierten PKI auf der Ethereum Blockchain.
//               Verwaltet die Einsätze (Stakes), die Registrierung und die Belohnung/Bestrafung von Nodes, die am Anwendungskonsens teilnehmen.

pragma solidity ^0.8.21;

import "./interfaces/ILoggingManager.sol";
import "./interfaces/IConsensusManager.sol";

// Der StakeManager-Contract verwaltet die Einsätze (Stakes) von Nodes im System.
contract StakeManager {
    // Struktur für Informationen zu einem Staker.
    struct StakeInfo {
        uint256 amount;    // Betrag des eingesetzten Ethers
        bytes publicKey;   // Öffentlicher Schlüssel des Nodes
    }

    // Verknüpft Adressen mit ihren Einsatz-Informationen.
    mapping(address => StakeInfo) public stakers;
    // Liste aller registrierten Nodes.
    address[] public registeredNodes;
    // Pool für Belohnungen, die verteilt werden können.
    uint256 public rewardPool;
    // Schnittstellen zu Logging- und Consensus-Verträgen.
    ILoggingManager public loggingManager;
    IConsensusManager public consensusManager;
    uint256 public constant MIN_STAKE = 1000; // Beispielwert in Wei

    // Events zur Protokollierung wichtiger Aktionen.
    event NodeRegistered(address indexed node, uint256 stakeAmount);         // Node wurde registriert
    event Slashed(address indexed node, uint256 amount);                    // Node wurde bestraft
    event RewardsDistributed(uint256 indexed voteId, address indexed node, uint256 amount); // Belohnungen wurden verteilt

    // Konstruktor: Initialisiert die Logging-Schnittstelle.
    constructor(address _loggingManager) {
        loggingManager = ILoggingManager(_loggingManager);
    }

    // Funktion zum Setzen der ConsensusManager-Adresse (einmalig).
    function setConsensusManager(address _consensusManager) public {
        require(address(consensusManager) == address(0), "ConsensusManager already set");
        consensusManager = IConsensusManager(_consensusManager);
    }

    // Funktion zur Registrierung eines Nodes mit einem Einsatz.
    function registerNode(bytes memory _publicKey) public payable {
        require(msg.value >= MIN_STAKE, "Stake-Betrag muss mindestens MIN_STAKE sein");
        require(stakers[msg.sender].amount == 0, "Node ist bereits registriert");

        // Speichert die Einsatz-Informationen des Nodes.
        stakers[msg.sender] = StakeInfo({
            amount: msg.value,
            publicKey: _publicKey
        });

        registeredNodes.push(msg.sender);
        emit NodeRegistered(msg.sender, msg.value);
    }

    // Funktion zum Zurückziehen des Einsatzes durch einen Node.
    function withdrawStake() public {
        StakeInfo storage stake = stakers[msg.sender];
        require(stake.amount > 0, "Kein Stake vorhanden");
        uint256 amount = stake.amount;
        delete stakers[msg.sender];

        // Entfernt den Node aus der Liste der registrierten Nodes.
        for (uint256 i = 0; i < registeredNodes.length; i++) {
            if (registeredNodes[i] == msg.sender) {
                registeredNodes[i] = registeredNodes[registeredNodes.length - 1];
                registeredNodes.pop();
                break;
            }
        }
        payable(msg.sender).transfer(amount); // Überweist den Einsatz zurück
    }

    // Funktion zum Bestrafen eines Nodes (Slash) und Hinzufügen zum Belohnungspool.
    function slashNode(address _node, uint256 _slashAmount) public {
        require(stakers[_node].amount >= _slashAmount, "Nicht genug Stake zum Slashen");
        stakers[_node].amount -= _slashAmount;
        rewardPool += _slashAmount;
        loggingManager.logAction(msg.sender, keccak256(abi.encodePacked("slashNode", _node, _slashAmount)));
        emit Slashed(_node, _slashAmount);
    }

    // Funktion zur Prüfung, ob eine Adresse ein registrierter Node ist.
    function isRegisteredNode(address node) public view returns (bool) {
        return stakers[node].amount > 0;
    }

    // Funktion zum Abrufen des Einsatzes eines Nodes.
    function getStake(address node) public view returns (uint256) {
        return stakers[node].amount;
    }

    // Funktion zum Abrufen des gesamten Einsatzes aller Nodes.
    function getTotalStake() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < registeredNodes.length; i++) {
            total += stakers[registeredNodes[i]].amount;
        }
        return total;
    }

    // Funktion zum Hinzufügen von Ether zum Belohnungspool.
    function addToRewardPool() public payable {
        rewardPool += msg.value;
    }

    // Funktion zur Verteilung von Belohnungen basierend auf einer Abstimmung.
    function distributeRewards(uint256 _voteId) public {
        require(rewardPool > 0, "No rewards available");
        require(address(consensusManager) != address(0), "ConsensusManager not set");

        // Holt die Wähler der Abstimmung und berechnet den gesamten Einsatz der Befürworter.
        address[] memory voters = consensusManager.getVotersForVote(_voteId);
        uint256 totalStakeFor = 0;
        for (uint256 i = 0; i < voters.length; i++) {
            if (consensusManager.getVoteResult(_voteId)) {
                totalStakeFor += stakers[voters[i]].amount;
            }
        }

        if (totalStakeFor == 0) return; // Keine Befürworter, keine Verteilung

        // Berechnet und verteilt die Belohnungen proportional zum Einsatz.
        uint256 rewardPerStake = rewardPool / totalStakeFor;
        for (uint256 i = 0; i < voters.length; i++) {
            if (consensusManager.getVoteResult(_voteId)) {
                uint256 reward = rewardPerStake * stakers[voters[i]].amount;
                rewardPool -= reward;
                payable(voters[i]).transfer(reward);
                emit RewardsDistributed(_voteId, voters[i], reward);
            }
        }
    }
}
