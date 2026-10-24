"use client";

import Link from "next/link";

import { Header } from "@/components/Header";
import { money, ShortDay } from "@/lib/format";
import { useStore } from "@/lib/store";

/** The orders placed from this browser (there are no accounts: the browser keeps each order's link). */
export default function OrdersPage() {
  const orders = useStore((s) => s.orders);
  return (
    <div className="page">
      <Header />
      <main className="main-narrow">
        <h1 className="title">Tus pedidos</h1>
        {orders.length === 0 ? (
          <div className="empty">
            Todavía no hiciste pedidos desde este navegador. <Link href="/">Ver las huertas cercanas</Link>
          </div>
        ) : (
          orders.map((o) => (
            <Link
              key={o.code}
              href={`/pedido/${o.code}?t=${encodeURIComponent(o.token)}`}
              className="card elev-sm"
              style={{ padding: "16px 20px", flexDirection: "row", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
            >
              <span>
                <span className="card-title">Pedido #{o.code}</span>
                <span className="small-muted" style={{ display: "block" }}>
                  Entrega {ShortDay(o.delivery_date)}
                </span>
              </span>
              <span style={{ fontWeight: 600 }}>{money(o.total)}</span>
            </Link>
          ))
        )}
        <span className="small-muted">Sin cuenta: cada pedido se abre con su enlace. Si cambiás de navegador, usá el enlace que guardaste.</span>
      </main>
    </div>
  );
}
