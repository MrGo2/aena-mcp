# ✈️ AENA Flights MCP

[![CI](https://github.com/MrGo2/aena-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MrGo2/aena-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcp-aena)](https://www.npmjs.com/package/mcp-aena)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English: [README.md](README.md)**

Datos de vuelos en vivo de los 50 aeropuertos españoles de AENA, como servidor MCP. Pregúntale a Claude cosas como *"¿qué salidas hay en Santiago esta tarde?"* o *"¿va con retraso el IB0459?"* y responde con datos reales del aeropuerto: horarios, puertas, terminales, avión, estado y codeshares.

Une las dos APIs de vuelos de AENA tras un mismo conjunto de herramientas, de modo que un agente pide vuelos y recibe siempre el mismo objeto de vuelo, venga de la API que venga.

## 🚀 Úsalo en 30 segundos (sin instalar nada)

El servidor corre en público en `https://aena-mcp.carlos-ls.workers.dev/mcp`. Añádelo a Claude con un click:

**[➕ Añadir a Claude](https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=AENA%20Flights&connectorUrl=https%3A%2F%2Faena-mcp.carlos-ls.workers.dev%2Fmcp)**

Ese enlace abre claude.ai con el connector ya rellenado; solo hay que confirmar. Funciona en todos los planes, Free incluido, y una vez añadido queda disponible también en las apps de Claude, móvil incluido. Sin cuenta, sin API key, sin configurar nada.

¿Prefieres añadirlo a mano? Claude → Ajustes → Connectors → Add custom connector, nómbralo `AENA Flights` y pega la URL de arriba.

### 🤖 También funciona en ChatGPT

ChatGPT no tiene enlace de instalación con un click, pero el mismo servidor funciona allí (planes Plus, Pro y Business, solo web):

1. Ajustes → Apps → Advanced settings → activa el **Developer mode**
2. En el panel de Apps pulsa **+** y añade el servidor con la URL `https://aena-mcp.carlos-ls.workers.dev/mcp`, autenticación: ninguna

## 💬 Cosas que puedes preguntar

- 🛫 "Salidas de MAD entre las 16:00 y las 18:00"
- 🛬 "¿Qué vuelos llegan a BCN desde Londres mañana por la tarde?"
- 🔍 "¿Dónde está el vuelo UX7235, qué puerta tiene?"
- 🏝️ "Lista los aeropuertos de AENA en Canarias"

## 🖥️ Otras formas de usarlo

| Cómo | Para quién | Instalación |
|---|---|---|
| ☁️ Connector remoto (arriba) | Todo el mundo, iPhone incluido | Un click |
| 📦 Extensión de escritorio | Claude Desktop | Descarga `aena-mcp.mcpb` de la [última release](https://github.com/MrGo2/aena-mcp/releases/latest), doble click |
| 🟩 npm | Claude Code, Cursor, cualquier cliente MCP | `npx mcp-aena` |
| 🔧 Desde el código | Desarrolladores | Ver abajo |

Configuración para clientes vía npm:

```json
{
  "mcpServers": {
    "aena": {
      "command": "npx",
      "args": ["-y", "mcp-aena"]
    }
  }
}
```

Para Claude Code es un solo comando:

```bash
claude mcp add aena -- npx -y mcp-aena
```

## 🧰 Herramientas

- `search_flights` — llegadas o salidas de un aeropuerto. Filtra por número de vuelo, por fecha o por franja horaria local (tarde = `fromLocal 12:00`, `toLocal 20:00`). Los codeshares del mismo vuelo físico se agrupan en una sola entrada, y todas las horas de la salida son hora local de Madrid.
- `get_flight` — un vuelo concreto por número en un aeropuerto.
- `list_airports` — todos los aeropuertos de AENA con códigos IATA/ICAO, en vivo.

## 🔀 Por qué hay dos APIs

AENA ofrece dos formas de leer vuelos, y cada una cubre un hueco que la otra deja abierto.

- 🌐 La **API web** es pública y no necesita credenciales. Ve unos 14 días hacia adelante pero no tiene pasado. Buena para descubrir vuelos.
- 🔐 La **API REST** usa OAuth2 y necesita un client secret. Ve unas 54 horas de pasado y 24 de futuro, e indica el vuelo operador real detrás de un codeshare. Buena para seguimiento.

El servidor elige la fuente adecuada por ti (`source: "auto"`), o puedes forzar cualquiera. Sin secret funciona en modo solo-web y sigue siendo útil. El servidor remoto público ya trae el acceso REST completo configurado.

## 🛠️ Desde el código

```bash
pnpm install
pnpm build      # tsc → dist/
pnpm test       # tests sobre fixtures capturados, sin red ni credenciales
pnpm inspect    # sesión stdio en vivo con el inspector MCP
```

Copia `.env.example` a `.env`. La API web no necesita nada. Para la API REST pon `AENA_CLIENT_SECRET`; `AENA_CLIENT_ID` y `AENA_TENANT_ID` ya traen valores por defecto que funcionan.

El servidor remoto público vive en [`worker/`](worker/) (Cloudflare Workers, Streamable HTTP, sin auth). Para hospedar el tuyo:

```bash
cd worker
pnpm install
npx wrangler deploy
npx wrangler secret put AENA_CLIENT_SECRET   # opcional, activa la fuente REST
```

El parseo vive en normalizadores puros (`normalizeWebsiteRow`, `normalizeRestRow`), así que el mapeo se prueba sin llamada real. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

CI corre los tests en Node 20 y 22 más un smoke del inspector MCP. Los tags (`v*`) publican en npm (OIDC trusted publishing), en el MCP Registry, y adjuntan un bundle `.mcpb` a la release de GitHub.

## 📝 Notas sobre los datos

- Llegadas es `"A"` en la API REST pero `"L"` en la API web. El servidor lo esconde.
- El campo REST `airlineIATA` lleva en realidad el código ICAO. El servidor resuelve ambos.
- El número de vuelo cambia según la fuente: la API REST nombra por ICAO (`VLG1674`) y la web por IATA (`VY1674`).
- Ninguna API filtra por número de vuelo en el servidor, así que las búsquedas bajan el aeropuerto entero y filtran en local.
- Ninguna da hora real de despegue o aterrizaje, solo programada y estimada. Para wheels-off y wheels-on hace falta una fuente como FlightRadar24.

## 📄 Licencia

MIT
