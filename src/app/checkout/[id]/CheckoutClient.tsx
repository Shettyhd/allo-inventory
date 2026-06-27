"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, MapPin, Package,
  ShoppingBag, ArrowLeft, Loader2, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useToast } from "@/components/ui/toast";
import { formatINR } from "@/lib/utils";
import type { Reservation } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface CheckoutClientProps {
  initialReservation: Reservation;
}

export function CheckoutClient({ initialReservation }: CheckoutClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [reservation, setReservation] = React.useState(initialReservation);
  const [confirming, setConfirming] = React.useState(false);
  const [releasing, setReleasing] = React.useState(false);

  const isSettled = reservation.status !== "PENDING";

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": uuidv4() },
      });
      const data = await res.json();
      if (res.status === 410) {
        toast({ type: "error", title: "Reservation expired", description: data.error });
        setReservation((r) => ({ ...r, status: "RELEASED" }));
        return;
      }
      if (!res.ok) {
        toast({ type: "error", title: "Confirmation failed", description: data.error });
        return;
      }
      setReservation((r) => ({ ...r, status: "CONFIRMED", confirmedAt: data.confirmedAt }));
      toast({ type: "success", title: "Purchase confirmed!", description: "Your order is on its way." });
    } catch {
      toast({ type: "error", title: "Network error", description: "Please try again." });
    } finally {
      setConfirming(false);
    }
  }

  async function handleRelease() {
    setReleasing(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: "Cancel failed", description: data.error });
        return;
      }
      setReservation((r) => ({ ...r, status: "RELEASED", releasedAt: new Date().toISOString() }));
      toast({ type: "info", title: "Reservation cancelled", description: "Units returned to stock." });
    } catch {
      toast({ type: "error", title: "Network error", description: "Please try again." });
    } finally {
      setReleasing(false);
    }
  }

  function handleExpired() {
    setReservation((r) => ({ ...r, status: "RELEASED" }));
  }

  const total = reservation.product.price * reservation.quantity;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to catalogue
      </button>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Checkout</h1>

      {/* Status banner */}
      {reservation.status === "CONFIRMED" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">Purchase confirmed</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              Your order has been placed successfully.
            </p>
          </div>
        </div>
      )}

      {reservation.status === "RELEASED" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 p-5">
          <XCircle className="h-6 w-6 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Reservation cancelled</p>
            <p className="text-sm text-red-700 mt-0.5">
              The units have been returned to stock.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Product */}
        <div className="flex gap-4 p-6 border-b border-slate-100">
          {reservation.product.imageUrl ? (
            <img
              src={reservation.product.imageUrl}
              alt={reservation.product.name}
              className="w-20 h-20 rounded-xl object-cover bg-slate-100 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Package className="h-8 w-8 text-slate-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 text-lg leading-snug">
              {reservation.product.name}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {reservation.warehouse.name} · {reservation.warehouse.location}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Badge variant="secondary">Qty: {reservation.quantity}</Badge>
              <Badge
                variant={
                  reservation.status === "CONFIRMED" ? "success" :
                  reservation.status === "RELEASED" ? "destructive" :
                  "default"
                }
              >
                {reservation.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex justify-between text-sm text-slate-500 mb-1">
            <span>{formatINR(reservation.product.price)} × {reservation.quantity}</span>
            <span>{formatINR(reservation.product.price * reservation.quantity)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-lg">
            <span>Total</span>
            <span className="text-indigo-600">{formatINR(total)}</span>
          </div>
        </div>

        {/* Countdown + actions */}
        <div className="p-6 flex flex-col gap-4">
          {reservation.status === "PENDING" && (
            <>
              <CountdownTimer expiresAt={reservation.expiresAt} onExpired={handleExpired} />
              <div className="flex gap-3">
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={handleConfirm}
                  disabled={confirming || releasing}
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  {confirming ? "Confirming…" : "Confirm purchase"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRelease}
                  disabled={confirming || releasing}
                >
                  {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  {releasing ? "Cancelling…" : "Cancel"}
                </Button>
              </div>
            </>
          )}

          {isSettled && (
            <Button variant="outline" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4" />
              Return to catalogue
            </Button>
          )}
        </div>
      </div>

      {/* Reservation meta */}
      <div className="mt-4 px-1 text-xs text-slate-400 flex gap-4">
        <span>ID: <code>{reservation.id.slice(0, 8)}…</code></span>
        <span>Reserved at: {new Date(reservation.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
