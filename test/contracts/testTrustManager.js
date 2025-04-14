// Autor: Philipp Feil
// Datum: 02.04.2025
// Beschreibung: Testsuite für den TrustManager Smart Contract.
// Testet die Verwaltung von Vertrauen, CA-Registrierung, Delegation und Blacklisting.

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustManager Contract Tests", function () {
    let TrustManager, LoggingManager;
    let trustManager, loggingManager;
    let owner, addr1, addr2, addr3;

    // Einrichtungsfunktion, die vor jedem Testfall ausgeführt wird
    beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        // LoggingManager-Vertrag bereitstellen
        const LoggingManagerFactory = await ethers.getContractFactory("LoggingManager");
        loggingManager = await LoggingManagerFactory.deploy();
        await loggingManager.waitForDeployment();

        // TrustManager-Vertrag bereitstellen
        const TrustManagerFactory = await ethers.getContractFactory("TrustManager");
        trustManager = await TrustManagerFactory.deploy(loggingManager.target);
        await trustManager.waitForDeployment();

        // TrustManager im LoggingManager autorisieren
        await loggingManager.addAuthorized(trustManager.target);
    });

    // Testfall: Prüft das erfolgreiche Hinzufügen einer CA
    it("sollte eine CA erfolgreich hinzufügen", async function () {
        const tx = await trustManager.connect(owner).addCA(addr1.address);
        await expect(tx).to.emit(trustManager, "CAAdded").withArgs(addr1.address, owner.address);
        const isCA = await trustManager.isCA(addr1.address);
        expect(isCA).to.equal(true);
    });

    // Testfall: Verhindert das Hinzufügen einer CA ohne CA-Status
    it("sollte das Hinzufügen einer CA ohne CA-Status verhindern", async function () {
        await expect(trustManager.connect(addr1).addCA(addr2.address))
            .to.be.revertedWith("Nur eine CA kann diese Funktion ausfuehren");
    });

    // Testfall: Prüft das erfolgreiche Setzen des Vertrauenslevels
    it("sollte das Vertrauenslevel erfolgreich setzen", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr2.address, 5);
        const trustLevel = await trustManager.trustLevels(addr2.address);
        expect(trustLevel).to.equal(5);
    });

    // Testfall: Verhindert das Setzen des Vertrauenslevels ohne CA-Status
    it("sollte das Setzen des Vertrauenslevels ohne CA-Status verhindern", async function () {
        await expect(trustManager.connect(addr1).setTrustLevel(addr2.address, 5))
            .to.be.revertedWith("Nur eine CA kann diese Funktion ausfuehren");
    });

    // Testfall: Prüft die erfolgreiche Delegation von Vertrauen
    it("sollte Vertrauen erfolgreich delegieren", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 10); // Setze Level für addr1
        const tx = await trustManager.connect(addr1).delegateTrust(addr2.address);
        await expect(tx).to.emit(trustManager, "TrustDelegated").withArgs(addr1.address, addr2.address);
        const trustedBy = await trustManager.trustedBy(addr2.address);
        expect(trustedBy).to.equal(addr1.address);
    });

    // Testfall: Verhindert die Delegation ohne ausreichendes Vertrauenslevel
    it("sollte das Delegieren ohne ausreichendes Vertrauenslevel verhindern", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 1); // Level 1
        await expect(trustManager.connect(addr1).delegateTrust(addr2.address))
            .to.be.revertedWith("Nur Entitaeten mit Level > 1 koennen delegieren");
    });

    // Testfall: Prüft das erfolgreiche Widerrufen von Vertrauen
    it("sollte Vertrauen erfolgreich widerrufen", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 10);
        await trustManager.connect(addr1).delegateTrust(addr2.address);
        const tx = await trustManager.connect(addr1).revokeTrust(addr2.address);
        await expect(tx).to.emit(trustManager, "TrustRevoked").withArgs(addr2.address, addr1.address);
        const trustedBy = await trustManager.trustedBy(addr2.address);
        expect(trustedBy).to.equal(ethers.ZeroAddress);
    });

    // Testfall: Verhindert das Widerrufen ohne Delegator-Status
    it("sollte das Widerrufen ohne Delegator-Status verhindern", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 10);
        await trustManager.connect(addr1).delegateTrust(addr2.address);
        await expect(trustManager.connect(addr3).revokeTrust(addr2.address))
            .to.be.revertedWith("Nur der ausstellende CA darf widerrufen");
    });

    // Testfall: Prüft, ob eine Entität als vertrauenswürdig erkannt wird
    it("sollte prüfen, ob eine Entität vertrauenswürdig ist", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 10);
        await trustManager.connect(addr1).delegateTrust(addr2.address);
        const isTrusted = await trustManager.isTrusted(addr2.address);
        expect(isTrusted).to.equal(true);
    });

    // Testfall: Ruft die Root-CA einer Entität ab
    it("sollte die Root-CA einer Entität abrufen", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 10);
        await trustManager.connect(addr1).delegateTrust(addr2.address);
        const rootCA = await trustManager.getRootCA(addr2.address);
        expect(rootCA).to.equal(addr1.address);
    });

    // Testfall: Ruft die delegierten Entitäten einer Adresse ab
    it("sollte die delegierten Entitäten abrufen", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(addr1).setTrustLevel(addr1.address, 10);
        await trustManager.connect(addr1).delegateTrust(addr2.address);
        await trustManager.connect(addr1).delegateTrust(addr3.address);
        const delegated = await trustManager.getDelegatedEntities(addr1.address);
        expect(delegated.length).to.equal(2);
        expect(delegated[0]).to.equal(addr2.address);
        expect(delegated[1]).to.equal(addr3.address);
    });

    // Testfall: Prüft das Abstimmen zum Blacklisten einer CA
    it("sollte für das Blacklisten einer CA abstimmen", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(owner).addCA(addr2.address);
        await trustManager.connect(addr1).voteToBlacklistCA(addr2.address);
        const votes = await trustManager.getVotesAgainstCA(addr2.address);
        expect(votes.length).to.equal(1);
        expect(votes[0]).to.equal(addr1.address);
    });

    // Testfall: Ruft die Stimmen gegen eine CA ab
    it("sollte die Stimmen gegen eine CA abrufen", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(owner).addCA(addr2.address);
        await trustManager.connect(owner).addCA(addr3.address);
        await trustManager.connect(addr1).voteToBlacklistCA(addr2.address);
        await trustManager.connect(addr3).voteToBlacklistCA(addr2.address);
        const votes = await trustManager.getVotesAgainstCA(addr2.address);
        expect(votes.length).to.equal(2);
        expect(votes[0]).to.equal(addr1.address);
        expect(votes[1]).to.equal(addr3.address);
    });

    // Testfall: Prüft, ob eine CA als blacklisted erkannt wird
    it("sollte prüfen, ob eine CA blacklisted ist", async function () {
        await trustManager.connect(owner).addCA(addr1.address);
        await trustManager.connect(owner).addCA(addr2.address);
        await trustManager.connect(owner).addCA(addr3.address);
        await trustManager.connect(addr1).voteToBlacklistCA(addr2.address);
        await trustManager.connect(addr3).voteToBlacklistCA(addr2.address);
        const isBlacklisted = await trustManager.isCABlacklisted(addr2.address);
        expect(isBlacklisted).to.equal(true); // 2 Stimmen von 3 CAs
    });

    // Testfall: Prüft das erfolgreiche Setzen der vertrauenswürdigen Zeit
    it("sollte die vertrauenswürdige Zeit erfolgreich setzen", async function () {
        const newTime = Math.floor(Date.now() / 1000) + 3600;
        await trustManager.connect(owner).setTrustedTime(newTime);
        const trustedTime = await trustManager.getCurrentTime();
        expect(trustedTime).to.equal(newTime);
    });

    // Testfall: Verhindert das Setzen der Zeit ohne Oracle-Status
    it("sollte das Setzen der Zeit ohne Oracle-Status verhindern", async function () {
        const newTime = Math.floor(Date.now() / 1000) + 3600;
        await expect(trustManager.connect(addr1).setTrustedTime(newTime))
            .to.be.revertedWith("Nur das autorisierte Zeit-Oracle darf das setzen");
    });

    // Testfall: Ruft die aktuelle Zeit ab
    it("sollte die aktuelle Zeit abrufen", async function () {
        const currentTime = await trustManager.getCurrentTime();
        const blockTime = (await ethers.provider.getBlock("latest")).timestamp;
        expect(currentTime).to.be.closeTo(blockTime, 10); // Toleranz für Netzwerklatenz
    });
});