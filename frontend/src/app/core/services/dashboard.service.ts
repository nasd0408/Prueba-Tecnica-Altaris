import { Injectable } from '@angular/core';

import { api } from '../http/api-client';
import { Hotel } from '../models/hotel';

export interface CountItem {
  label: string;
  count: number;
}

export interface DashboardSummary {
  totalHotels: number;
  activeHotels: number;
  countries: number;
  cities: number;
  hotelsByCountry: CountItem[];
  hotelsByStars: CountItem[];
  latestHotels: Hotel[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/dashboard');
    return data;
  }
}
