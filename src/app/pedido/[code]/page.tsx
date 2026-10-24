"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Header } from "@/components/Header";
import { marketApi, type OrderStatus } from "@/lib/api";
import { money, shortDay } from "@/lib/format";
import { useStore } from "@/lib/store";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "recibido", label: "Recibido" },
  { status: "en_preparacion", label: "En preparación" },
  { status: "en_camino", label: "En camino" },
  { status: "entregado", label: "Entregado" },
];
const PART_LABEL = { nuevo: "Recibido", prep: "Preparando", listo: "Listo para retiro", entregado: "Entregado", rechazado: "No llega" };

/** Following an order without an account: the code and its token (in the link, or remembered by this browser). */
function OrderView() {
  const { code } = useParams<{ code: string }>();
  const params = useSearchParams();
  const remembered = useStore((s) => s.orders.find((o) => String(o.code) === code)?.token);
  const token = params.get("t") ?? remembered ?? "";
  const order = useQuery({ queryKey: ["order", code, token], queryFn: () => marketApi.order(code, token), enabled: !!token, refetchInterval: 60_000 });
  const [copied, setCopied] = useState(false);
  const o = order.data;
  const reached = o ? STEPS.findIndex((s) => s.status === o.status) : -1;
  const link = typeof window !== "undefined" && token ? `${window.location.origin}/pedido/${code}?t=${encodeURIComponent(token)}` : "";

  return (
    <main className="main-narrow">
      <Link href="/" style={{ fontSize: 14 }}>
        ← Volver a las huertas
      </Link>
      {!token && <div className="empty">Para ver este pedido hace falta el enlace que recibiste al confirmarlo.</div>}
      {order.isError && <div className="error">{order.error.message}</div>}
      {o && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">Pedido #{o.code}</span>
            <h1 className="title">{o.status === "cancelado" ? "No se pudo armar" : o.status === "entregado" ? "Entregado" : `Llega el ${shortDay(o.delivery_date)}`}</h1>
            <span className="muted">
              {o.delivery_window} · {o.delivery_address}
              {o.recurring && " · se repite cada semana"}
            </span>
          </div>
          {o.status !== "cancelado" && (
            <div className="steps">
              {STEPS.map((s, i) => (
                <span key={s.status} className={`step${i <= reached ? " done" : ""}`}>
                  <span className="dot" />
                  {s.label}
                </span>
              ))}
            </div>
          )}
          <div className="card elev-sm" style={{ padding: 24, gap: 16 }}>
            {o.parts.map((p) => (
              <div key={p.producer_name} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: p.status === "rechazado" ? 0.55 : 1 }}>
                <div className="row" style={{ alignItems: "center" }}>
                  <span className="card-title">{p.producer_name}</span>
                  <span className={`tag ${p.status === "rechazado" ? "tag-accent" : "tag-accent-2"}`}>{PART_LABEL[p.status]}</span>
                </div>
                {p.items.map((i) => (
                  <div key={i.title} className="row" style={{ fontSize: 14 }}>
                    <span>
                      {i.title} · {i.kg} kg{!i.from_stock && " · preventa"}
                    </span>
                    <span>{money(i.total)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="totals">
              <div className="row">
                <span>Subtotal</span>
                <span>{money(o.subtotal)}</span>
              </div>
              <div className="row">
                <span>Logística consolidada</span>
                <span>{o.subtotal > 0 && o.logistics_fee === 0 ? "Bonificada" : money(o.logistics_fee)}</span>
              </div>
              <div className="row grand">
                <span>Total</span>
                <span>{money(o.total)}</span>
              </div>
            </div>
            <span className="small-muted">Todo llega junto, en una sola factura de Red Km 0 a {o.buyer_name}.</span>
          </div>
          <div className="delivery">
            <strong>Guardá este enlace</strong>
            <span>Es la forma de volver a tu pedido sin cuenta. Este navegador también lo recuerda en “Tus pedidos”.</span>
            <button
              className="btn btn-secondary"
              style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 13 }}
              onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}
            >
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function OrderPage() {
  return (
    <div className="page">
      <Header />
      <Suspense>
        <OrderView />
      </Suspense>
    </div>
  );
}
