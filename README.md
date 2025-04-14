# Blockchain-basierte Public Key Infrastruktur
---
## Beschreibung
Dieses Repository enthält den Code für den Prototypen einer Blockchain-basierten Public Key Infrastructure (PKI), der im Rahmen der Bachelorarbeit "Blockchain-basierte Public Key Infrastructure als Ersatz für Zertifizierungsstellen" (Hochschule Mannheim, 2025) entwickelt wurde. Ziel der Arbeit ist es, die Machbarkeit der Nutzung von Ethereum Smart Contracts zu demonstrieren, um eine dezentrale, transparente und manipulationssichere Alternative zu traditionellen, CA-basierten PKIs zu schaffen und deren bekannte Schwachstellen (z.B. Single Point of Failure, mangelnde Transparenz, ineffiziente Sperrmechanismen) zu adressieren. Der implementierte Prototyp fokussiert sich auf Kernfunktionen wie die Verwaltung des Zertifikatslebenszyklus (Ausstellung, Validierung, Widerruf) mittels modularer Smart Contracts.

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

* **Weitere Projektdateien:**
    * `hardhat.config.js`: Konfigurationsdatei für das Hardhat-Framework, die Netzwerkeinstellungen (für Sepolia), Solidity-Compiler-Versionen und Wallet-Schlüssel verwaltet.
    * `LICENSE`: Enthält die Lizenzinformationen für den Code.
    * `README.md`: Diese Datei, die das Projekt beschreibt.

---

## Verwendete Technologien 
* **Programmiersprache:** Solidity (0.8.21) 
* **Blockchain-Plattform:** Ethereum (Proof-of-Stake) 
* **Netzwerk:** Sepolia Testnetzwerk (für Deployment und Tests) 
* **Entwicklungs-/Test-Framework:** Hardhat (v2.22.19) 
* **Test-Bibliotheken:** Mocha, Chai (mit Hardhat verwendet) 
* **Skripting/Tests:** JavaScript (für Hardhat-Tests/-Skripte)
---


## Installation / Setup

Um das Projekt lokal einzurichten, die Smart Contracts zu kompilieren, Tests auszuführen und die Contracts auf einem Testnetzwerk (z.B. Sepolia) bereitzustellen, müssen folgende Schritte durchgeführt werden:

### Voraussetzungen

* Node.js (Version 16 oder höher empfohlen)
* npm (Node Package Manager, kommt mit Node.js)
* Git
---
### Lokales System einrichten (Kompilieren & Testen)

1.  **Repository klonen:**
    ```bash
    git clone https://github.com/philipp245/Blockchain-basierte-Public-Key-Infrastruktur.git
    cd Blockchain-basierte-Public-Key-Infrastruktur
    ```

2.  **Abhängigkeiten installieren:**
      Hinweis: Die Abhängigkeiten müssen in einem Anderen Ordner installiert werden.
    
        ```bash
        # 1. Initialisiert npm und erstellt eine package.json Datei
        npm init -y

        # 2. Installiert Hardhat als Entwicklungsabhängigkeit
        npm install --save-dev hardhat

        # 3. Initialisiert die Hardhat-Umgebung im aktuellen Ordner
        #    Wählen Sie "Create a JavaScript project".
        #    Bestätigen Sie die Fragen entsprechend (z.B. Projekt-Root, Gitignore hinzufügen).
        npx hardhat init

        # 4. Installiert das essentielle Hardhat Toolbox Plugin
        npm install --save-dev @nomicfoundation/hardhat-toolbox

        # 5. Installiert dotenv zur Verwaltung von Umgebungsvariablen
        #    (wichtig für private Schlüssel beim Deployment)
        npm install --save-dev dotenv
        ```
   Nach diesen Schritten sollten Sie eine `package.json`-Datei und einen `node_modules`-Ordner im Projektverzeichnis haben, die alle notwendigen Pakete enthalten.

   
   Achtung: Die beim installieren erstellten Ordner \contracts und \test müssen geleert werden und die Inhalte mit den Dateien aus diesem Repo ausgetauscht werden.
   \scripts muss ganz neu hinzugefügt werden.
   

3.  **Hardhat Konfiguration prüfen (`hardhat.config.js`):**
    Die `hardhat.config.js`-Datei im Hauptverzeichnis des Projekts sollte als Basisfunktion erstmal so aussehen:
    ```javascript
    require("@nomicfoundation/hardhat-toolbox");

    /** @type import('hardhat/config').HardhatUserConfig */
    module.exports = {
      solidity: {
        version: "0.8.21",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Optimierungseinstellung
          },
        },
      }
      // Netzwerkkonfigurationen für Deployment folgen später
    };
    ```

4.  **Contracts kompilieren:**
    Solidity Smart Contracts im `/contracts`-Verzeichnis kompilieren:
    ```bash
    npx hardhat compile
    ```
    Dies erstellt die notwendigen Artefakte (ABI, Bytecode) im `/artifacts`-Verzeichnis.

5.  **Tests ausführen:**
    Automatisierten Tests im `/test`-Verzeichnis, um die korrekte Funktionalität der Smart Contracts zu überprüfen:
    ```bash
    # Startet alle Testdateien im /test Ordner
    npx hardhat test

    # Optional: Startet nur die Tests für einen spezifischen Contract
    npx hardhat test ./test/testCertificateCore.js
    ```
    Alle Tests sollten erfolgreich durchlaufen.
---
### Smart Contracts auf Sepolia Testnet deployen

1.  **Deployment Skript prüfen:**
    Sicherstellen, dass das Deployment Skript (`scripts/deploy.js`) im `/scripts`-Ordner vorhanden ist und die Logik zum Deployen aller fünf Contracts sowie zur Initialisierung der Abhängigkeiten enthält.

2.  **Hardhat Konfiguration für Sepolia anpassen (`hardhat.config.js`):**
    Die `hardhat.config.js` muss erweitert werden, um das Sepolia-Netzwerk einzubinden. Hierzu wird ein RPC-Endpunkt (z.B. von Infura (https://www.infura.io/), Alchemy) und ein privater Schlüssel eines Ethereum-Kontos, das für das Deployment verwendet werden soll und die initiale Root-CA-Rolle übernimmt benötigt.

    **WICHTIG:** Speichern Sie sensible Daten wie private Schlüssel **NIEMALS** direkt in der Konfigurationsdatei! Nutzen Sie Umgebungsvariablen (z.B. über eine `.env`-Datei und das `dotenv`-Paket).

    ```javascript
    require("@nomicfoundation/hardhat-toolbox");
    require('dotenv').config(); // Lädt Umgebungsvariablen aus .env

    /** @type import('hardhat/config').HardhatUserConfig */
    module.exports = {
     solidity: {
        version: "0.8.21",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Optimierungseinstellung
          },
        },
      }
      networks: {
        sepolia: {
          // Ersetzen Sie dies mit Ihrem RPC-Endpunkt für Sepolia
          url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID",
          // Ersetzen Sie dies mit dem privaten Schlüssel Ihres Deployment-Kontos
          accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
      },
    };
    ```
    * Erstellen Sie eine `.env`-Datei im Projekt-Root (fügen Sie sie zu `.gitignore` hinzu!) mit folgendem Inhalt:
        ```
        SEPOLIA_RPC_URL="IHRE_SEPOLIA_RPC_URL_HIER"
        PRIVATE_KEY="IHR_PRIVATER_SCHLUESSEL_HIER"
        ```
    * Installieren Sie `dotenv`: `npm install dotenv --save-dev`
    * Stellen Sie sicher, dass das Konto über ausreichend Sepolia Test-ETH verfügt (erhältlich über Sepolia Faucets).

3.  **Deployment ausführen:**
    Startet das Deployment auf dem Sepolia-Netzwerk:
    ```bash
    npx hardhat run scripts/deploy.js --network sepolia
    ```

4.  **Erwartete Ausgabe und Contract-Adressen:**
    Die Konsole zeigt den Fortschritt des Deployments. Nach erfolgreicher Ausführung sollten die Adressen der deployten Contracts ausgegeben werden. Hier ein Beispiel:
    ```
    Deploying contracts with account: 0x3fd62FD4b48B3968e798191f3b4A1e08D980Ff87
    LoggingManager deployed to: 0x9873638f6533625e221ddF1F79b2F7B643d0570a
    StakeManager deployed to: 0x0A43b809737e85f6fb8980600968b539a0a5d766
    TrustManager deployed to: 0x6DDc5386e42664A58c3d1903Bafbdd1d0F77733d
    ConsensusManager deployed to: 0xCD0A1eB3068E518D7A9E1C92fA60F6504613bc29
    ConsensusManager set in StakeManager
    CertificateCore deployed to: 0x17A34b12C1C0df0809C2d927459Bfd2683BBC035
    Deployment completed!
    ```
    Notieren Sie sich diese Adressen. Sie können sie verwenden, um die Contracts auf Etherscan (Sepolia) zu überprüfen oder über Skripte mit ihnen zu interagieren.
---
### Smart Contracts auf Sepolia Testnet Testen

Nachdem die Smart Contracts erfolgreich auf dem Sepolia Testnetzwerk bereitgestellt wurden (Deployment), können die manuellen Testskripte (`test1.js`, `testSuite1.js`, `testSuite2.js`) aus dem `/scripts`-Verzeichnis genutzt werden, um die Funktionalität unter realitätsnahen Bedingungen zu validieren. Diese Tests simulieren die Interaktion verschiedener Akteure und überprüfen Kernprozesse sowie Fehlerfälle im dezentralen Netzwerk.

Folgen Sie diesen Schritten, um die Nutzungstests auf Sepolia durchzuführen:

1.  **Wallet-Konfiguration für Tests anpassen (`hardhat.config.js`):**
    * Für die Simulation verschiedener Rollen (z.B. Deployer/Root-CA, weitere CAs, Nodes) benötigen Sie mehrere Ethereum-Konten (Wallets). Die Tests verwenden drei separate Wallets.
    * Stellen Sie sicher, dass jedes dieser Konten über ausreichend **Sepolia Test-ETH** verfügt. Diese erhalten Sie kostenlos über öffentliche Sepolia Faucets.
    * Fügen Sie die **privaten Schlüssel** aller für die Tests benötigten Konten zum `accounts`-Array in der `sepolia`-Netzwerkkonfiguration Ihrer `hardhat.config.js`-Datei hinzu. Das erste Konto in der Liste wird oft als Deployer verwendet, die weiteren können dann in den Skripten für andere Rollen genutzt werden.
    * **WICHTIGER SICHERHEITSHINWEIS:** Speichern Sie private Schlüssel **niemals** direkt im Code oder committen Sie sie in die Versionskontrolle! Nutzen Sie zwingend Umgebungsvariablen (z.B. über eine `.env`-Datei und das `dotenv`-Paket), um die Schlüssel sicher zu laden.
        ```javascript
        // Beispiel für mehrere Test-Konten in hardhat.config.js
        require("@nomicfoundation/hardhat-toolbox");
        require('dotenv').config(); // Lädt Umgebungsvariablen aus .env

        module.exports = {
          // ... solidity config ...
          networks: {
            sepolia: {
              url: process.env.SEPOLIA_RPC_URL || "IHRE_SEPOLIA_RPC_URL",
              accounts: [
                process.env.PRIVATE_KEY_DEPLOYER || "PRIVATER_SCHLUESSEL_WALLET_1",
                process.env.PRIVATE_KEY_USER1 || "PRIVATER_SCHLUESSEL_WALLET_2",
                process.env.PRIVATE_KEY_USER2 || "PRIVATER_SCHLUESSEL_WALLET_3",
                // Fügen Sie bei Bedarf weitere Schlüssel hinzu
              ]
            },
          },
        };
        ```

2.  **Contract-Adressen in Testskripten aktualisieren:**
    * Nach dem erfolgreichen Deployment (siehe vorheriger Abschnitt "Smart Contracts auf Sepolia Testnet deployen") erhalten Sie eine Konsolenausgabe mit den spezifischen Adressen Ihrer neu bereitgestellten Smart Contracts auf Sepolia.
    * Öffnen Sie die manuellen Testskripte im `/scripts`-Ordner: `test1.js`, `testSuite1.js`, `testSuite2.js`.
    * Suchen Sie in diesen Skripten die Stellen, an denen die Adressen der Smart Contracts definiert oder benötigt werden (oft am Anfang des Skripts oder dort, wo Contract-Instanzen erzeugt werden).
    * **Ersetzen Sie die Platzhalter oder alten Adressen in den Skripten manuell** mit denjenigen Adressen, die bei **Ihrem** letzten Deployment ausgegeben wurden. Nur so können die Skripte mit den korrekten, von Ihnen deployten Contract-Instanzen auf Sepolia interagieren.

3.  **Manuelle Testskripte ausführen:**
    Führen Sie die vorbereiteten und angepassten Testskripte nacheinander über Hardhat im Sepolia-Netzwerk aus:
    ```bash
    npx hardhat run scripts/test1.js --network sepolia
    npx hardhat run scripts/testSuite1.js --network sepolia
    npx hardhat run scripts/testSuite2.js --network sepolia
    ```


Hinweis: Beim Erstellen dieser README.md wurde ChatGPT als Formulierungshilfe genutzt, um den Abschnitt 'Installation / Setup' möglichst einfach zu formulieren.
