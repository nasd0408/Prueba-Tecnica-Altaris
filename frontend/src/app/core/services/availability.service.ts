import { Injectable } from '@angular/core';

import { api } from '../http/api-client';
import {
  AvailabilityGrid,
  BulkAvailabilityRequest,
  BulkAvailabilityResult,
  InventoryOverview,
} from '../models/availability';

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  async getGrid(hotelId: number, from: string, to: string): Promise<AvailabilityGrid> {
    const { data } = await api.get<AvailabilityGrid>(`/hotels/${hotelId}/availability`, { params: { from, to } });
    return data;
  }

  async bulkLoad(hotelId: number, request: BulkAvailabilityRequest): Promise<BulkAvailabilityResult> {
    const { data } = await api.post<BulkAvailabilityResult>(`/hotels/${hotelId}/availability`, request);
    return data;
  }

  async getOverview(from: string, to: string, country?: string): Promise<InventoryOverview> {
    const params: Record<string, string> = { from, to };
    if (country) params['country'] = country;
    const { data } = await api.get<InventoryOverview>('/inventory/overview', { params });
    return data;
  }
}
