"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Package, MapPin, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatINR } from "@/lib/utils";
import type { Product, StockEntry } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = React.useState<StockEntry | null>(
    product.stock.find((s) => s.available > 0) ?? null
  );
  const [quantity, setQuantity] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const totalAvailable = product.stock.reduce((s, x) => s + x.available, 0);

  async function handleReserve() {
    if (!selectedStock) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedStock.warehouseId,
          quantity,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast({
          type: "error",
          title: "Not enough stock",
          description: `Only ${data.available} unit(s) available at ${selectedStock.warehouseName}.`,
        });
        return;
      }
      if (!res.ok) {
        toast({ type: "error", title: "Reservation failed", description: data.error });
        return;
      }
      toast({ type: "success", title: "Reserved!", description: "You have 10 minutes to complete your purchase." });
      router.push(`/checkout/${data.id}`);
    } catch {
      toast({ type: "error", title: "Network error", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function stockBadge(available: number) {
    if (available === 0) return <Badge variant="destructive">Out of stock</Badge>;
    if (available <= 3) return <Badge variant="warning">Only {available} left</Badge>;
    return <Badge variant="success">{available} available</Badge>;
  }

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-200 flex flex-col">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="h-16 w-16 text-slate-300" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          {stockBadge(totalAvailable)}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        <div>
          <h2 className="font-bold text-slate-900 text-lg leading-snug">{product.name}</h2>
          {product.description && (
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{product.description}</p>
          )}
          <p className="mt-2 text-2xl font-bold text-indigo-600">{formatINR(product.price)}</p>
        </div>

        {/* Warehouse selector */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Select Warehouse
          </p>
          <div className="flex flex-col gap-1.5">
            {product.stock.map((s) => (
              <button
                key={s.warehouseId}
                onClick={() => {
                  if (s.available > 0) {
                    setSelectedStock(s);
                    setQuantity(1);
                  }
                }}
                disabled={s.available === 0}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 border text-sm transition-colors ${
                  selectedStock?.warehouseId === s.warehouseId
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : s.available > 0
                    ? "border-slate-200 hover:border-slate-300 text-slate-700"
                    : "border-slate-100 text-slate-400 cursor-not-allowed bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 opacity-60" />
                  {s.warehouseName}
                </span>
                <span className="text-xs font-semibold">
                  {s.available > 0 ? `${s.available} units` : "Out of stock"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity + CTA */}
        {selectedStock && selectedStock.available > 0 && (
          <div className="flex items-center gap-3 mt-auto">
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-lg font-bold"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold text-slate-800">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(selectedStock.available, q + 1))}
                className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-lg font-bold"
              >
                +
              </button>
            </div>
            <Button className="flex-1" onClick={handleReserve} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {loading ? "Reserving…" : "Reserve"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
