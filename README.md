# Blockchain-basierte Public Key Infrastruktur
---
## Beschreibung
Dieses Repository enthält den Code für den Prototypen einer Blockchain-basierten Public Key Infrastructure (PKI), der im Rahmen der Bachelorarbeit "Blockchain-basierte Public Key Infrastructure (PKI) als Ersatz für Zertifizierungsstellen (CAs)" (Hochschule Mannheim, 2025) entwickelt wurde. Ziel des Arbeit ist es, die Machbarkeit der Nutzung von Ethereum Smart Contracts zu demonstrieren, um eine dezentrale, transparente und manipulationssichere Alternative zu traditionellen, CA-basierten PKIs zu schaffen und deren bekannte Schwachstellen (z.B. Single Point of Failure, mangelnde Transparenz, ineffiziente Sperrmechanismen) zu adressieren. Der implementierte Prototyp fokussiert sich auf Kernfunktionen wie die Verwaltung des Zertifikatslebenszyklus (Ausstellung, Validierung, Widerruf) mittels modularer Smart Contracts.

--- 

## Aufbau des Projekts

Das Repository ist wie folgt organisiert:
* **/contracts:** Dieser Ordner enthält den gesamten Solidity-Quellcode für die Smart Contracts und deren Interfaces.
    * **/contracts/interfaces:** Beinhaltet die Solidity Interfaces (`ILoggingManager`, `IStakeManager`, `ITrustManager`, `IConsensusManager`, `ICertificateCore`).
    * Die Kernlogik der Blockchain-PKI in fünf spezialisierten Smart Contracts aufgeteilt:
        * **CertificateCore.sol:** Verwaltet den gesamten Lebenszyklus von Zertifikaten (Ausstellung, Widerruf, Erneuerung, Validierung) und fungiert als dezentrales Zertifikatsverzeichnis.
        * **StakeManager.sol:** Verwaltet die Einsätze (Stakes), Registrierung und Belohnung/Bestrafung von Nodes, die am Konsens auf Anwendungsebene teilnehmen.
        * **ConsensusManager.sol:** Koordiniert Abstimmungsprozesse (Stake-gewichtet) auf Anwendungsebene für dezentrale Entscheidungen.
        * **TrustManager.sol:** Verwaltet die Liste autorisierter CAs, delegiertes Vertrauen und stellt potenziell eine vertrauenswürdige Zeit bereit.
        * **LoggingManager.sol:** Dient als zentrales, manipulationssicheres Protokollierungssystem für wichtige Aktionen innerhalb der anderen Contracts.

* **/scripts:** Dieser Ordner enthält JavaScript-Skripte, die mit Hardhat ausgeführt werden können, für das Deployment der Contracts oder für manuelle Interaktions- und Nutzungstests auf einem Netzwerk.
    * **deploy.js:** Das Skript für das Deployment aller Smart Contracts auf einem Zielenetzwerk (z.B. Sepolia Testnetz). Es berücksichtigt die Abhängigkeiten zwischen den Contracts und führt notwendige Initialisierungsschritte nach dem Deployment durch.
    * **test1.js:** Ein manuelles Testskript zur Überprüfung des Deployments und der Einrichtung auf Sepolia.
    * **testSuite1.js:** Ein manuelles Testskript zur Prüfung von Kernfunktionen (Node-Registrierung, Konsens, Zertifikats-Lifecycle, Vertrauensdelegierung) auf Sepolia.
    * **testSuite2.js:** Ein manuelles Testskript zur Simulation eines Multi-Node/Multi-CA-Szenarios inklusive Fehlerfällen auf Sepolia.

* **/test:** Dieser Ordner enthält alle automatisierten Testdateien, die mit dem Hardhat-Framework ausgeführt werden, um die Korrektheit und Funktionalität der Smart Contracts zu überprüfen.
    * **/contracts/testCertificateCore.js:** Unit-Tests speziell für den `CertificateCore`-Contract.
    * **/contracts/testConsensusManager.js:** Unit-Tests speziell für den `ConsensusManager`-Contract.
    * **/contracts/testLoggingManager.js:** Unit-Tests speziell für den `LoggingManager`-Contract.
    * **/contracts/testStakeManager.js:** Unit-Tests speziell für den `StakeManager`-Contract.
    * **/contracts/testTrustManager.js:** Unit-Tests speziell für den `TrustManager`-Contract.
    * **testAnforderungen.js:** Anforderungs- und Integrationstests, die spezifische funktionale und nicht-funktionale Anforderungen validieren.
    * **testUseCases.js:** Anforderungs- und Integrationstests, die kombinierte Anwendungsfälle und komplexere Szenarien über mehrere Schritte hinweg prüfen.

* **(Weitere Projektdateien):**
    * `hardhat.config.js`: Konfigurationsdatei für das Hardhat-Framework, die Netzwerkeinstellungen (für Sepolia), Solidity-Compiler-Versionen und Wallet-Schlüssel verwaltet.
    * `LICENSE`: Enthält die Lizenzinformationen für den Code.
    * `README.md`: Diese Datei, die das Projekt beschreibt.

---

## Verwendete Technologien 
* **Programmiersprache:** Solidity (^0.8.21) 
* **Blockchain-Plattform:** Ethereum (Proof-of-Stake) 
* **Netzwerk:** Sepolia Testnetzwerk (für Deployment und Tests) 
* **Entwicklungs-/Test-Framework:** Hardhat (v2.22.19) 
* **Test-Bibliotheken:** Mocha, Chai (mit Hardhat verwendet) 
* **Skripting/Tests:** JavaScript (für Hardhat-Tests/-Skripte)
---


## Installation / Setup
Um das Projekt lokal einzurichten und die notwendigen Abhängigkeiten zu installieren, folgen Sie diesen Schritten:

