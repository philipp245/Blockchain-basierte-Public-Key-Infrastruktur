// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für den StakeManager Smart Contract.
// Testet die Funktionalitäten zur Registrierung, Rücknahme, Bestrafung und Belohnungsverteilung von Nodes.

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakeManager Contract Tests", function () {
    let StakeManager, LoggingManager, ConsensusManager;
    let stakeManager, loggingManager, consensusManager;
    let owner, addr1, addr2;

    // Einrichtungsfunktion, die vor jedem Testfall ausgeführt wird
    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
    
        // LoggingManager-Vertrag bereitstellen
        const LoggingManagerFactory = await ethers.getContractFactory("LoggingManager");
        loggingManager = await LoggingManagerFactory.deploy();
        await loggingManager.waitForDeployment();
    
        // ConsensusManager-Vertrag bereitstellen
        const ConsensusManagerFactory = await ethers.getContractFactory("ConsensusManager");
        consensusManager = await ConsensusManagerFactory.deploy(owner.address, loggingManager.target);
        await consensusManager.waitForDeployment();
    
        // StakeManager-Vertrag bereitstellen
        const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
        stakeManager = await StakeManagerFactory.deploy(loggingManager.target);
        await stakeManager.waitForDeployment();
    
        // StakeManager im LoggingManager autorisieren
        await loggingManager.addAuthorized(stakeManager.target);
    
        // ConsensusManager im StakeManager setzen
        await stakeManager.setConsensusManager(consensusManager.target);
    });

    // Testfall: Prüft die erfolgreiche Registrierung eines Nodes
    it("sollte einen Knoten erfolgreich registrieren", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const stakeAmount = ethers.parseEther("1"); // Größer als MIN_STAKE (1000 Wei)
        const tx = await stakeManager.connect(addr1).registerNode(publicKey, { value: stakeAmount });
        await expect(tx).to.emit(stakeManager, "NodeRegistered").withArgs(addr1.address, stakeAmount);
    });

    // Testfall: Verhindert die Registrierung mit unzureichendem Einsatz
    it("sollte die Registrierung bei unzureichendem Stake verhindern", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const insufficientStake = ethers.parseUnits("500", "wei"); // Unter MIN_STAKE (1000 Wei)
        await expect(stakeManager.connect(addr1).registerNode(publicKey, { value: insufficientStake }))
            .to.be.revertedWith("Stake-Betrag muss mindestens MIN_STAKE sein");
    });

    // Testfall: Prüft die erfolgreiche Rücknahme eines Einsatzes
    it("sollte einem Knoten erlauben, den Stake erfolgreich zurückzuziehen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const stakeAmount = ethers.parseEther("1");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: stakeAmount });
        const initialBalance = await ethers.provider.getBalance(addr1.address);
        const tx = await stakeManager.connect(addr1).withdrawStake();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        const finalBalance = await ethers.provider.getBalance(addr1.address);
        expect(finalBalance).to.be.gt(initialBalance - gasUsed);
    });

    // Testfall: Verhindert die Rücknahme eines Einsatzes bei nicht registrierten Nodes
    it("sollte den Rückzug verhindern, wenn nicht registriert", async function () {
        await expect(stakeManager.connect(addr1).withdrawStake())
            .to.be.revertedWith("Kein Stake vorhanden");
    });

    // Testfall: Prüft die erfolgreiche Bestrafung eines Nodes
    it("sollte einen Knoten erfolgreich bestrafen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const stakeAmount = ethers.parseEther("1");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: stakeAmount });
        const slashAmount = ethers.parseEther("0.5");
        const tx = await stakeManager.slashNode(addr1.address, slashAmount);
        await expect(tx).to.emit(stakeManager, "Slashed").withArgs(addr1.address, slashAmount);
        const remainingStake = await stakeManager.getStake(addr1.address);
        expect(remainingStake).to.equal(stakeAmount - slashAmount);
    });

    // Testfall: Verhindert die Bestrafung eines Nodes mit unzureichendem Einsatz
    it("sollte das Bestrafen bei unzureichendem Einsatz verhindern", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const stakeAmount = ethers.parseEther("1");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: stakeAmount });
        const slashAmount = ethers.parseEther("1.5");
        await expect(stakeManager.slashNode(addr1.address, slashAmount))
            .to.be.revertedWith("Nicht genug Stake zum Slashen");
    });

    // Testfall: Prüft, ob ein Node als registriert erkannt wird
    it("sollte prüfen, ob ein Knoten registriert ist", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        const isRegistered = await stakeManager.isRegisteredNode(addr1.address);
        expect(isRegistered).to.equal(true);
    });

    // Testfall: Ruft den Einsatz eines Nodes ab
    it("sollte den Stake eines Knotens abrufen", async function () {
        const publicKey = ethers.toUtf8Bytes("publicKey_test");
        const stakeAmount = ethers.parseEther("1");
        await stakeManager.connect(addr1).registerNode(publicKey, { value: stakeAmount });
        const stake = await stakeManager.getStake(addr1.address);
        expect(stake).to.equal(stakeAmount);
    });

    // Testfall: Ruft den gesamten Einsatz aller Nodes ab
    it("sollte den Gesamtstake abrufen", async function () {
        const publicKey1 = ethers.toUtf8Bytes("publicKey_test1");
        const publicKey2 = ethers.toUtf8Bytes("publicKey_test2");
        const stakeAmount = ethers.parseEther("1");
        await stakeManager.connect(addr1).registerNode(publicKey1, { value: stakeAmount });
        await stakeManager.connect(addr2).registerNode(publicKey2, { value: stakeAmount });
        const totalStake = await stakeManager.getTotalStake();
        expect(totalStake).to.equal(stakeAmount * BigInt(2));
    });

    // Testfall: Prüft das Hinzufügen zum Belohnungspool
    it("sollte zum Belohnungspool hinzufügen", async function () {
        const addAmount = ethers.parseEther("2");
        await stakeManager.addToRewardPool({ value: addAmount });
        const pool = await stakeManager.rewardPool();
        expect(pool).to.equal(addAmount);
    });

    // Testfall: Prüft die Verteilung von Belohnungen (Platzhalter)
    // it("should distribute rewards successfully", async function () {
        // Annahme: ConsensusManager muss Abstimmungen simulieren
        // Dieser Test ist ein Platzhalter, da ConsensusManager nicht vollständig ist
        // const publicKey = ethers.toUtf8Bytes("publicKey_test");
        // await stakeManager.connect(addr1).registerNode(publicKey, { value: ethers.parseEther("1") });
        // await stakeManager.addToRewardPool({ value: ethers.parseEther("2") });
        // Hier müsste ConsensusManager eine Abstimmung und Wähler bereitstellen
        // await expect(stakeManager.distributeRewards(0))
        //     .to.be.revertedWith("ConsensusManager not fully implemented for this test");
    // });
});