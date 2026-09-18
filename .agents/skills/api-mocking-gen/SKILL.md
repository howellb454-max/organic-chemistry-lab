---
name: api-mocking-gen
description: Genera mocks de respuestas JSON/SMILES para PubChem y OPSIN para pruebas locales offline.
---

# External API Mocking Generator

Al simular respuestas de APIs externas:
1. Genera payloads ficticios pero sintácticamente válidos de PubChem REST API y OPSIN.
2. Proporciona estructuras de error simuladas (404 no encontrado, 500 timeout, respuestas malformadas).
3. Diseña fixtures para MSW (Mock Service Worker) o handlers en el cliente para desarrollo offline.
