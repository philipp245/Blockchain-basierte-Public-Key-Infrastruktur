// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für den ConsensusManager Smart Contract.
// Testet die Erstellung, Abstimmung und Verwaltung von Konsensabstimmungen und Vorschlägen.

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ConsensusManager Contract Tests", function () {
    let ConsensusManager, StakeManager, LoggingManager;
    let consensusManager, stakeManager, loggingManager;
    let owner, addr1, addr2, addr3;

    // Einrichtungsfunktion, die vor jedem Testfall ausgeführt wird
    beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        // LoggingManager-Vertrag bereitstellen
        const LoggingManagerFactory = await ethers.getContractFactory("LoggingManager");
        loggingManager = await LoggingManagerFactory.deploy();
        await loggingManager.waitForDeployment();

        // StakeManager-Vertrag bereitstellen
        const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
        stakeManager = await StakeManagerFactory.deploy(loggingManager.target);
        await stakeManager.waitForDeployment();

        // ConsensusManager-Vertrag bereitstellen
        const ConsensusManagerFactory = await ethers.getContractFactory("ConsensusManager");
        consensusManager = await ConsensusManagerFactory.deploy(stakeManager.target, loggingManager.target);
        await consensusManager.waitForDeployment();
    });

    // Testfall: Prüft die erfolgreiche Erstellung einer Konsensabstimmung
    it("sollte eine Konsensabstimmung erfolgreich erstellen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        const tx = await consensusManager.connect(addr1).createConsensusVote(actionHash);
        await expect(tx).to.emit(consensusManager, "ConsensusVoteCreated").withArgs(0, actionHash);
    });

    // Testfall: Verhindert die Erstellung einer Abstimmung ohne registrierten Node
    it("sollte das Erstellen einer Abstimmung ohne registrierten Node verhindern", async function () {
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await expect(consensusManager.connect(addr1).createConsensusVote(actionHash))
            .to.be.revertedWith("Nur registrierte Nodes koennen diese Funktion ausfuehren");
    });

    // Testfall: Prüft das erfolgreiche Abstimmen über eine Konsensabstimmung
    it("sollte erfolgreich über eine Abstimmung abstimmen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await consensusManager.connect(addr1).createConsensusVote(actionHash);
        const tx = await consensusManager.connect(addr1).voteOnConsensus(0, true);
        await expect(tx).to.emit(consensusManager, "ConsensusVoteCast")
            .withArgs(0, addr1.address, true, ethers.parseEther("1"));
    });

    // Testfall: Verhindert das Abstimmen ohne registrierten Node
    it("sollte das Abstimmen ohne registrierten Node verhindern", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await consensusManager.connect(addr1).createConsensusVote(actionHash);
        await expect(consensusManager.connect(addr2).voteOnConsensus(0, true))
            .to.be.revertedWith("Nur registrierte Nodes koennen diese Funktion ausfuehren");
    });

    // Testfall: Ruft die Wähler einer Abstimmung ab
    it("sollte die Wähler einer Abstimmung abrufen", async function () {
        const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
        const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
        await stakeManager.connect(addr1).registerNode(publicKey1, { value: ethers.parseEther("1") });
        await stakeManager.connect(addr2).registerNode(publicKey2, { value: ethers.parseEther("1") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await consensusManager.connect(addr1).createConsensusVote(actionHash);
        await consensusManager.connect(addr1).voteOnConsensus(0, true);
        await consensusManager.connect(addr2).voteOnConsensus(0, false);
        const voters = await consensusManager.getVotersForVote(0);
        expect(voters.length).to.equal(2);
        expect(voters).to.include(addr1.address);
        expect(voters).to.include(addr2.address);
    });

    // Testfall: Prüft die erfolgreiche Erstellung eines Vorschlags
    it("sollte einen Vorschlag erfolgreich erstellen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const proposalHash = ethers.keccak256(ethers.toUtf8Bytes("test_proposal"));
        const description = "Test proposal";
        const tx = await consensusManager.connect(addr1).createProposal(proposalHash, description);
        await expect(tx).to.emit(consensusManager, "ProposalCreated")
            .withArgs(0, proposalHash, addr1.address);
    });

    // Testfall: Prüft das erfolgreiche Abstimmen über einen Vorschlag
    it("sollte erfolgreich über einen Vorschlag abstimmen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const proposalHash = ethers.keccak256(ethers.toUtf8Bytes("test_proposal"));
        const description = "Test proposal";
        await consensusManager.connect(addr1).createProposal(proposalHash, description);
        const tx = await consensusManager.connect(addr1).voteOnProposal(0, true);
        await expect(tx).to.emit(consensusManager, "ProposalVoted")
            .withArgs(0, addr1.address, true);
    });

    // Testfall: Ruft die Details eines Vorschlags ab
    it("sollte die Details eines Vorschlags abrufen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const proposalHash = ethers.keccak256(ethers.toUtf8Bytes("test_proposal"));
        const description = "Test proposal";
        await consensusManager.connect(addr1).createProposal(proposalHash, description);
        const [pHash, desc, stakeFor, stakeAgainst, executed, proposer] = await consensusManager.getProposal(0);
        expect(pHash).to.equal(proposalHash);
        expect(desc).to.equal(description);
        expect(stakeFor).to.equal(0);
        expect(stakeAgainst).to.equal(0);
        expect(executed).to.equal(false);
        expect(proposer).to.equal(addr1.address);
    });

    // Testfall: Prüft, ob eine Abstimmung ausgeführt wurde
    it("sollte prüfen, ob eine Abstimmung ausgeführt wurde", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await consensusManager.connect(addr1).createConsensusVote(actionHash);
        const isExecuted = await consensusManager.isVoteExecuted(0);
        expect(isExecuted).to.equal(false); // Noch nicht ausgeführt
    });

    // Testfall: Ruft das Ergebnis einer Abstimmung ab
    it("sollte das Ergebnis einer Abstimmung abrufen", async function () {
        const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
        const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
        await stakeManager.connect(addr1).registerNode(publicKey1, { value: ethers.parseEther("1") });
        await stakeManager.connect(addr2).registerNode(publicKey2, { value: ethers.parseEther("2") });
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await consensusManager.connect(addr1).createConsensusVote(actionHash);
        await consensusManager.connect(addr1).voteOnConsensus(0, true); // 1 Ether dafür
        await consensusManager.connect(addr2).voteOnConsensus(0, false); // 2 Ether dagegen
        const result = await consensusManager.getVoteResult(0);
        expect(result).to.equal(false); // stakeFor (1) < stakeAgainst (2)
    });
});