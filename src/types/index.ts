export interface StockEntry {
  stockLevelId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reserved: number;
  available: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  stock: StockEntry[];
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface Reservation {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string;
  confirmedAt?: string | null;
  releasedAt?: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}
