// Mirrors AvailabilityDtos.cs in the backend.

export interface AvailabilityDay {
  date: string; // yyyy-MM-dd
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
  price: number; // effective price (override or base price)
  priceOverridden: boolean;
}

export interface RoomAvailability {
  roomId: number;
  roomTypeName: string;
  basePrice: number;
  days: (AvailabilityDay | null)[]; // one per date of the range, null = no inventory loaded
}

export interface AvailabilityGrid {
  from: string;
  to: string;
  rooms: RoomAvailability[];
}

export interface BulkAvailabilityRequest {
  roomIds: number[];
  from: string;
  to: string;
  daysOfWeek: number[]; // 0 = Sunday, same as Date.getDay() and .NET DayOfWeek
  totalRooms: number;
  price: number | null;
  resetPrice: boolean;
}

export interface BulkAvailabilityResult {
  created: number;
  updated: number;
}

export interface InventoryDay {
  date: string;
  totalRooms: number;
  bookedRooms: number;
  soldOutRooms: number;
}

export interface TightHotel {
  hotelId: number;
  name: string;
  city: string;
  country: string;
  totalRoomNights: number;
  bookedRoomNights: number;
  occupancy: number; // 0..1
}

export interface InventoryOverview {
  from: string;
  to: string;
  totalRoomNights: number;
  bookedRoomNights: number;
  soldOutRoomNights: number;
  days: InventoryDay[];
  tightestHotels: TightHotel[];
}
