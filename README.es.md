# AENA Flights MCP

[![CI](https://github.com/MrGo2/aena-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MrGo2/aena-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcp-aena)](https://www.npmjs.com/package/mcp-aena)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English: [README.md](README.md)**

Un servidor MCP con datos de vuelos de los 50 aeropuertos españoles de AENA. Une las dos APIs de vuelos de AENA tras un mismo conjunto de herramientas, de modo que un agente pide vuelos y recibe siempre el mismo objeto de vuelo, venga de la API que venga.

## Por qué hay dos APIs

AENA ofrece dos formas de leer vuelos, y cada una cubre un hueco que la otra deja abierto.

- **API web** es pública y no necesita credenciales. Ve unos 14 días hacia adelante pero no tiene pasado, y da horas locales. Buena para descubrir vuelos.
- **API REST** usa OAuth2 y necesita un client secret. Ve unas 54 horas de pasado y 24 de futuro, da horas en UTC, e indica el vuelo operador real detrás de un codeshare. Buena para seguimiento.

El servidor elige la fuente adecuada por ti (`source: "auto"`), o puedes forzar cualquiera. Sin secret funciona en modo solo-web y sigue siendo útil.

## Herramientas

- `search_flights` — llegadas o salidas de un aeropuerto, con filtro opcional por número de vuelo.
- `get_flight` — un vuelo concreto por número en un aeropuerto.
- `list_airports` — todos los aeropuertos de AENA con códigos IATA/ICAO, en vivo.

## Instalación

```bash
pnpm install
pnpm build
```

## Configuración

Copia `.env.example` a `.env`. La API web no necesita nada. Para la API REST pon `AENA_CLIENT_SECRET`; `AENA_CLIENT_ID` y `AENA_TENANT_ID` ya traen valores por defecto que funcionan.

```json
{
  "mcpServers": {
    "aena": {
      "command": "node",
      "args": ["/ruta/a/aena-mcp/dist/index.js"]
    }
  }
}
```

## Desarrollo

```bash
pnpm install
pnpm build      # tsc → dist/
pnpm test       # tests sobre fixtures capturados, sin red ni credenciales
pnpm inspect    # sesión stdio en vivo con el inspector MCP
```

El parseo vive en normalizadores puros (`normalizeWebsiteRow`, `normalizeRestRow`), así que el mapeo se prueba sin llamada real. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

CI corre los tests en Node 20 y 22 más un smoke del inspector MCP. Los tags (`v*`) publican en npm (OIDC trusted publishing), en el MCP Registry, y adjuntan un bundle `.mcpb` a la release de GitHub.

## Notas sobre los datos

- Llegadas es `"A"` en la API REST pero `"L"` en la API web. El servidor lo esconde.
- El campo REST `airlineIATA` lleva en realidad el código ICAO. El servidor resuelve ambos.
- Ninguna API filtra por número de vuelo en el servidor, así que las búsquedas bajan el aeropuerto entero y filtran en local.
- Ninguna da hora real de despegue o aterrizaje, solo programada y estimada. Para wheels-off y wheels-on hace falta una fuente como FlightRadar24.

## Licencia

MIT
