# Red Km 0 — mercado

El lado comprador de **Red Km 0**: restaurantes, verdulerías, hoteles y familias compran verdura agroecológica de
las huertas cercanas de la red, con una sola entrega consolidada y una sola factura.

Implementa la vista *Comprador* del diseño `Red Km0 Marketplace v2` (Claude Design): mapa minimal de las huertas con
distancias, fila de productores para filtrar, publicaciones como tarjetas (cuánto abastecen por semana y por cuántas
semanas, stock libre de la semana, disponible ahora / desde / preventa, precio) y el carrito a la derecha.

## Cómo encaja

| Pieza | Repo | Qué hace |
|---|---|---|
| API | `agroai_crops-agent-api` → módulo `src/application/market` (schema `market`) | Catálogo público, pedidos sin cuenta, publicaciones, pedidos del productor, rutas de retiro, planes Free/Pro |
| Productor | `agroai_web-monitoring` → `/mercado` | Publicar lotes, aceptar y armar pedidos cajón por cajón, retiro del día, ventas y plan |
| Comprador | este repo | Lo público: catálogo, carrito, pedido con email, seguimiento |

- **Nada sembrado se publica solo.** El productor publica un lote a propósito; si el lote se pierde, se termina la
  cosecha o tiene una carencia vigente, la API lo saca de venta (o corre su fecha) sola.
- **Sin cuenta para comprar.** El pedido lleva nombre, email y dirección; la API devuelve una vez un `token` que,
  con el número de pedido, abre `/pedido/<código>?t=<token>`. Este navegador guarda los enlaces en *Tus pedidos*
  (localStorage).
- **Ubicación aproximada.** Las huertas aparecen en un punto redondeado a ~500 m: muchas son la casa de alguien.
- **Mapa real con Mapbox** (Leaflet, el mismo `NEXT_PUBLIC_MAPBOX_TOKEN` que usa `agroai_web-monitoring`), estilo
  `mapbox/light-v11` para que quede minimal como el diseño; los pines y etiquetas son los del diseño. Sin token, cae
  al mapa dibujado del diseño (calles inventadas de fondo, huertas ubicadas por coordenadas).

## Desarrollo

```bash
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3001
npm run typecheck && npm run lint
```

La API tiene que permitir este origen: `CORS_ORIGINS=http://localhost:3000,http://localhost:3001`.

Datos de ejemplo (las seis huertas del diseño alrededor de City Bell), contra una API local con
`ALLOW_PUBLIC_SIGNUP=true` y el email de admin en `PLATFORM_ADMIN_EMAILS`:

```bash
cd ../agroai_crops-agent-api
uv run python -m src.scripts.seed_market_demo --admin-email admin@example.com
```

Cada productor entra a `agroai_web-monitoring` con `<id>@redkm0.example.com` / `demo-pass-1`
(Marta, de Los Aromos: `aromos@redkm0.example.com`).

## Estilo

`src/styles/organic.css` es el sistema de diseño *Organic* exportado con el diseño (tokens + clases), sin cambios
salvo las fuentes, que sirve `next/font` (Caprasimo y Figtree). Para cambiar el look, tocar los tokens de ahí.

## Pendiente

- Mails al comprador y al productor (hoy: notificación in-app + push al productor; el comprador guarda su enlace).
- Pagos y liquidación semanal (el plan y la comisión ya se calculan; no hay cobro real).
- Pedidos recurrentes: se guarda «repetir cada semana», falta el job que los regenere.
- Límite de pedidos por IP/email en los endpoints públicos.
