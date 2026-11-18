// Mirrors RoomDto / SaveRoomRequest: a room type offered by one hotel, with its price and amenities.

export interface Room {
  id: number;
  hotelId: number;
  roomTypeId: number;
  roomTypeName: string;
  capacity: number;
  basePrice: number;
  amenities: { id: number; name: string }[];
}

export interface SaveRoomRequest {
  roomTypeId: number;
  basePrice: number;
  amenityIds: number[];
}
