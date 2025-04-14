// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für den LoggingManager Smart Contract.
// Testet die Protokollierung von Aktionen und den Zugriff auf Protokolldaten.

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoggingManager Contract Tests", function () {
    let LoggingManager;
    let loggingManager;
    let owner, addr1, addr2;

    // Einrichtungsfunktion, die vor jedem Testfall ausgeführt wird
    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // LoggingManager-Vertrag bereitstellen
        const LoggingManagerFactory = await ethers.getContractFactory("LoggingManager");
        loggingManager = await LoggingManagerFactory.deploy();
        await loggingManager.waitForDeployment();
        // Owner ist standardmäßig autorisiert durch den Konstruktor
    });

    // Testfall: Prüft das erfolgreiche Protokollieren einer Aktion
    it("sollte eine Aktion erfolgreich protokollieren", async function () {
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        const tx = await loggingManager.connect(owner).logAction(owner.address, actionHash);
        await expect(tx)
            .to.emit(loggingManager, "ActionLogged")
            .withArgs(owner.address, actionHash, await ethers.provider.getBlock("latest").then(block => block.timestamp));
    });

    // Testfall: Verhindert das Protokollieren ohne Autorisierung
    it("sollte das Protokollieren ohne Autorisierung verhindern", async function () {
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes("test_action"));
        await expect(loggingManager.connect(addr1).logAction(addr1.address, actionHash))
            .to.be.revertedWith("Nur autorisierte Entitaeten");
    });

    // Testfall: Ruft die Action-Hashes einer Entität ab
    it("sollte die Action-Hashes einer Entität abrufen", async function () {
        const actionHash1 = ethers.keccak256(ethers.toUtf8Bytes("test_action1"));
        const actionHash2 = ethers.keccak256(ethers.toUtf8Bytes("test_action2"));
        await loggingManager.connect(owner).logAction(owner.address, actionHash1);
        await loggingManager.connect(owner).logAction(owner.address, actionHash2);
        const hashes = await loggingManager.getActionHashes(owner.address);
        expect(hashes.length).to.equal(2);
        expect(hashes[0]).to.equal(actionHash1);
        expect(hashes[1]).to.equal(actionHash2);
    });
});