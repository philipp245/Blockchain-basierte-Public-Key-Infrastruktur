# Blockchain-basierte Public Key Infrastruktur
---
## Kurzbeschreibung
ToDo


---
## Kontext zur Bachelorarbeit
Dieser Code wurde im Rahmen meiner Bachelorarbeit mit dem Titel:
**"Blockchain-basierte Public Key Infrastruktur als Ersatz für Zertifizierungsstellen"**
an der Hochschule Mannheim im Studiengang Cyber Security entwickelt (Abgabe: 14.04.2025).

---
**Rolle des Codes in der Arbeit:**
Dieser Code implementiert den Prototypen einer Blockchain-basierten Public Key Infrastructure (PKI), der im Rahmen der Bachelorarbeit "[Blockchain-basierte Public Key Infrastructure (PKI) als Ersatz für Zertifizierungsstellen (CAs)]" konzipiert und entwickelt wurde. Das Ziel ist es, die Machbarkeit der Nutzung von Smart Contracts auf der Ethereum-Blockchain zu demonstrieren, um traditionelle PKI-Funktionen wie Zertifikatsausstellung, -widerruf und -validierung dezentraler, transparenter und manipulationssicherer zu gestalten.

Die Kernlogik ist modular in fünf spezialisierten Smart Contracts aufgeteilt:
* **CertificateCore:** Verwaltet den gesamten Lebenszyklus von Zertifikaten und fungiert als dezentrales Zertifikatsverzeichnis.
* **StakeManager:** Verwaltet die Einsätze (Stakes), Registrierung und Belohnung/Bestrafung von Nodes, die am Konsens auf Anwendungsebene teilnehmen.
* **ConsensusManager:** Koordiniert Abstimmungsprozesse (Stake-gewichtet) auf Anwendungsebene für dezentrale Entscheidungen.
* **TrustManager:** Verwaltet die Liste autorisierter CAs, delegiertes Vertrauen und stellt potenziell eine vertrauenswürdige Zeit bereit.
* **LoggingManager:** Dient als zentrales, manipulationssicheres Protokollierungssystem für wichtige Aktionen.

Das System wurde konzipiert, um Schwachstellen traditioneller PKIs wie zentrale Abhängigkeiten, mangelnde Transparenz und ineffiziente Sperrung (Kapitel 1.1, 2.1.6) durch Dezentralisierung, Blockchain-Transparenz und On-Chain-Statusverwaltung zu adressieren (Kapitel 2.4.1, 4.1). Der Code dient als Grundlage für die in Kapitel 6 beschriebenen Validierungen und Tests und soll die Reproduzierbarkeit der Ergebnisse ermöglichen.

---

## Verwendete Technologien / Abhängigkeiten
* **Programmiersprache:** Solidity (^0.8.21) 
* **Blockchain-Plattform:** Ethereum (Proof-of-Stake) 
* **Netzwerk:** Sepolia Testnetzwerk (für Deployment und Tests) 
* **Entwicklungs-/Test-Framework:** Hardhat (v2.22.19) 
* **Test-Bibliotheken:** Mocha, Chai (mit Hardhat verwendet) 
* **Skripting/Tests:** JavaScript (für Hardhat-Tests/-Skripte)
---
Eine detaillierte Liste der spezifischen -Abhängigkeiten

---

## Installation / Setup
Um das Projekt lokal einzurichten und die notwendigen Abhängigkeiten zu installieren, folgen Sie diesen Schritten:

