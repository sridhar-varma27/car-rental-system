
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

export interface Car {
  id: number;
  brand: string;
  model: string;
  category: string;
  pricePerDay: number;
  fuelType: string;
  transmission: string;
  seatingCapacity: number;
  imageUrl?: string;
  available: boolean;
  quantity: number;
  createdAt: string;
}

export interface Booking {
  id: number;
  userId: number;
  carId: number;
  carBrand: string;
  carModel: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  pricePerDay: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  paymentMethod: string;
  status: string;
  paymentDate: string;
  transactionId: string;
}
