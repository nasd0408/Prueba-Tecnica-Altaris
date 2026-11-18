import { Injectable } from '@angular/core';

import { api } from '../http/api-client';
import { PagedResult } from '../models/paged-result';
import {
  CreateReservationRequest,
  DailySummary,
  Quote,
  Reservation,
  ReservationListItem,
  ReservationQuery,
} from '../models/reservation';

export type ReservationAction = 'cancel' | 'check-in' | 'check-out' | 'no-show';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  async getReservations(query: ReservationQuery, signal?: AbortSignal): Promise<PagedResult<ReservationListItem>> {
    // Drop empty filters so the API sees "no filter" and the request URL stays readable.
    const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await api.get<PagedResult<ReservationListItem>>('/reservations', { params, signal });
    return data;
  }

  async getReservation(id: number): Promise<Reservation> {
    const { data } = await api.get<Reservation>(`/reservations/${id}`);
    return data;
  }

  async quote(roomId: number, checkIn: string, checkOut: string, rooms: number, signal?: AbortSignal): Promise<Quote> {
    const { data } = await api.get<Quote>('/reservations/quote', {
      params: { roomId, checkIn, checkOut, rooms },
      signal,
    });
    return data;
  }

  async create(request: CreateReservationRequest): Promise<Reservation> {
    const { data } = await api.post<Reservation>('/reservations', request);
    return data;
  }

  // One method for the four status actions: they share URL shape and response.
  async runAction(id: number, action: ReservationAction): Promise<Reservation> {
    const { data } = await api.post<Reservation>(`/reservations/${id}/${action}`);
    return data;
  }

  async getDaily(date: string): Promise<DailySummary> {
    const { data } = await api.get<DailySummary>('/reservations/daily', { params: { date } });
    return data;
  }
}
