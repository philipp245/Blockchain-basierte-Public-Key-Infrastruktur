# Blockchain-basierte Public Key Infrastruktur
---
## Kurzbeschreibung
Dieses Repository enthält den Code für den Prototypen einer Blockchain-basierten Public Key Infrastructure (PKI), der im Rahmen der Bachelorarbeit "Blockchain-basierte Public Key Infrastructure (PKI) als Ersatz für Zertifizierungsstellen (CAs)" (Hochschule Mannheim, 2025) entwickelt wurde. Ziel des Projekts ist es, die Machbarkeit der Nutzung von Ethereum Smart Contracts zu demonstrieren, um eine dezentrale, transparente und manipulationssichere Alternative zu traditionellen, CA-basierten PKIs zu schaffen und deren bekannte Schwachstellen (z.B. Single Point of Failure, mangelnde Transparenz, ineffiziente Sperrmechanismen) zu adressieren. Der implementierte Prototyp fokussiert sich auf Kernfunktionen wie die Verwaltung des Zertifikatslebenszyklus (Ausstellung, Validierung, Widerruf) mittels modularer Smart Contracts.

--- 

**Rolle des Codes in der Arbeit:**
Dieser Code implementiert den Prototypen einer Blockchain-basierten Public Key Infrastructure (PKI), der im Rahmen der Bachelorarbeit "Blockchain-basierte Public Key Infrastructure (PKI) als Ersatz für Zertifizierungsstellen (CAs)" konzipiert und entwickelt wurde. Das Ziel ist es, die Machbarkeit der Nutzung von Smart Contracts auf der Ethereum-Blockchain zu demonstrieren, um traditionelle PKI-Funktionen wie Zertifikatsausstellung, -widerruf und -validierung dezentraler, transparenter und manipulationssicherer zu gestalten.

Die Kernlogik ist modular in fünf spezialisierten Smart Contracts aufgeteilt:
* **CertificateCore:** Verwaltet den gesamten Lebenszyklus von Zertifikaten und fungiert als dezentrales Zertifikatsverzeichnis.
* **StakeManager:** Verwaltet die Einsätze (Stakes), Registrierung und Belohnung/Bestrafung von Nodes, die am Konsens auf Anwendungsebene teilnehmen.
* **ConsensusManager:** Koordiniert Abstimmungsprozesse (Stake-gewichtet) auf Anwendungsebene für dezentrale Entscheidungen.
* **TrustManager:** Verwaltet die Liste autorisierter CAs, delegiertes Vertrauen und stellt potenziell eine vertrauenswürdige Zeit bereit.
* **LoggingManager:** Dient als zentrales, manipulationssicheres Protokollierungssystem für wichtige Aktionen.

Das System wurde konzipiert, um Schwachstellen traditioneller PKIs wie zentrale Abhängigkeiten, mangelnde Transparenz und ineffiziente Sperrung durch Dezentralisierung, Blockchain-Transparenz und On-Chain-Statusverwaltung zu adressieren. Der Code dient als Grundlage für die in Kapitel 6 beschriebenen Validierungen und Tests und soll die Reproduzierbarkeit der Ergebnisse ermöglichen.

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

