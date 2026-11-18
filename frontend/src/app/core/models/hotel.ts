// Mirrors the API DTOs (HotelDto / SaveHotelRequest / HotelQuery in the backend).

export interface Hotel {
  id: number;
  name: string;
  city: string;
  country: string;
  address: string | null;
  stars: number;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  roomCount: number;
}

export type SaveHotelRequest = Omit<Hotel, 'id' | 'createdAt' | 'roomCount'>;

export interface HotelQuery {
  search?: string;
  country?: string;
  stars?: number;
  isActive?: boolean;
  page: number;
  pageSize: number;
}
