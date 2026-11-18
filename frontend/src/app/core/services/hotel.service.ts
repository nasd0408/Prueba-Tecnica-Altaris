import { Injectable } from '@angular/core';

import { api } from '../http/api-client';
import { Hotel, HotelQuery, SaveHotelRequest } from '../models/hotel';
import { PagedResult } from '../models/paged-result';

@Injectable({ providedIn: 'root' })
export class HotelService {
  async getHotels(query: HotelQuery, signal?: AbortSignal): Promise<PagedResult<Hotel>> {
    // Only send filters that have a value, so the URL stays clean and the API sees "no filter".
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
    if (query.search) params['search'] = query.search;
    if (query.country) params['country'] = query.country;
    if (query.stars) params['stars'] = query.stars;

    const { data } = await api.get<PagedResult<Hotel>>('/hotels', { params, signal });
    return data;
  }

  async getCountries(): Promise<string[]> {
    const { data } = await api.get<string[]>('/hotels/countries');
    return data;
  }

  async getHotel(id: number): Promise<Hotel> {
    const { data } = await api.get<Hotel>(`/hotels/${id}`);
    return data;
  }

  async createHotel(request: SaveHotelRequest): Promise<Hotel> {
    const { data } = await api.post<Hotel>('/hotels', request);
    return data;
  }

  async updateHotel(id: number, request: SaveHotelRequest): Promise<Hotel> {
    const { data } = await api.put<Hotel>(`/hotels/${id}`, request);
    return data;
  }
}
