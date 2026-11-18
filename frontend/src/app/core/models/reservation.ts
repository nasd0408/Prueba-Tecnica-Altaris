import { ApiErrorInfo } from '../http/api-error';

// Mirrors ReservationDtos.cs in the backend.

export type ReservationStatus = 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled' | 'NoShow';

// Labels live in the i18n dictionaries under "status.<value>".
export const RESERVATION_STATUSES: ReservationStatus[] = ['Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow'];

export interface ReservationListItem {
  id: number;
  code: string;
  hotelId: number;
  hotelName: string;
  city: string;
  roomTypeName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  guests: number;
  totalPrice: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface Reservation extends ReservationListItem {
  country: string;
  roomId: number;
  capacity: number;
  guestEmail: string;
  guestPhone: string | null;
  notes: string | null;
  createdBy: string | null;
  cancelledAt: string | null;
}

export interface CreateReservationRequest {
  roomId: number;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  notes: string | null;
}

export interface Quote {
  roomId: number;
  hotelName: string;
  roomTypeName: string;
  capacity: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  maxGuests: number;
  totalPrice: number;
  canBook: boolean;
  problem: ApiErrorInfo | null; // same code + args as an API error
  nightsDetail: { date: string; available: number | null; price: number }[];
}

export type ReservationDateType = 'checkIn' | 'checkOut' | 'stay' | 'created';

export interface ReservationQuery {
  search?: string;
  status?: ReservationStatus;
  hotelId?: number;
  dateType?: ReservationDateType;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface DailySummary {
  date: string;
  arrivals: number;
  arrivalsPending: number;
  departures: number;
  departuresPending: number;
  inHouse: number;
  newBookings: number;
  newBookingsRevenue: number;
  cancellations: number;
  byCountry: { country: string; arrivals: number; departures: number; inHouse: number }[];
}
