"use client";

import Link from "next/link";

import { useStore } from "@/lib/store";

const PRODUCER_APP = (process.env.NEXT_PUBLIC_PRODUCER_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The design's header. Buyers have no account: "Productor" leads to the producers' own app (AgroAI), where they
 * publish and prepare orders; on the right, the orders placed from this browser. */
export function Header() {
  const orders = useStore((s) => s.orders);
  return (
    <header className="nav header">
      <Link href="/" className="nav-brand brand">
        <span className="brand-dot" />
        Red Km 0
      </Link>
      <div className="seg" role="navigation" aria-label="Vista">
        <Link href="/" className="seg-opt" aria-current="page" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          Comprador
        </Link>
        <a href={`${PRODUCER_APP}/mercado`} className="seg-opt">
          Productor
        </a>
      </div>
      <Link href="/pedidos" className="header-orders" style={{ color: "inherit", textDecoration: "none" }}>
        <span className="count">{orders.length}</span>
        <span>Tus pedidos</span>
      </Link>
    </header>
  );
}
