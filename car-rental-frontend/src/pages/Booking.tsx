import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../services/api";
import type { Car } from "../types";

interface RentalDates {
  startDate?: string;
  endDate?: string;
}

function getToday(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function Booking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedDates = (location.state ?? {}) as RentalDates;

  const [car, setCar] = useState<Car | null>(null);
  const [startDate, setStartDate] = useState(
    selectedDates.startDate || getToday()
  );
  const [endDate, setEndDate] = useState(
    selectedDates.endDate || getTomorrow()
  );

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [checkingAvailability, setCheckingAvailability] =
    useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState("");

  const invalidDates =
    !startDate ||
    !endDate ||
    startDate < getToday() ||
    endDate <= startDate;

  useEffect(() => {
    let active = true;

    const fetchCar = async () => {
      try {
        const response = await api.get<Car>(`/cars/${id}`);

        if (active) {
          setCar(response.data);
        }
      } catch {
        if (active) {
          setError("Unable to load car details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (id) {
      void fetchCar();
    }

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;

    const checkAvailability = async () => {
      if (!id || invalidDates) {
        setIsAvailable(false);
        setCheckingAvailability(false);
        return;
      }

      setCheckingAvailability(true);

      try {
        const response = await api.get<Car[]>("/cars/available", {
          params: {
            startDate,
            endDate,
          },
        });

        if (active) {
          const matchingCar = response.data.find(
            (availableCar) =>
              String(availableCar.id) === id &&
              availableCar.available &&
              (availableCar.quantity ?? 0) > 0
          );

          setIsAvailable(Boolean(matchingCar));
          setError("");
        }
      } catch {
        if (active) {
          setIsAvailable(false);
          setError(
            "Unable to verify availability. Please try again."
          );
        }
      } finally {
        if (active) {
          setCheckingAvailability(false);
        }
      }
    };

    void checkAvailability();

    return () => {
      active = false;
    };
  }, [id, startDate, endDate, invalidDates]);

  const calculateDays = () => {
    if (invalidDates) {
      return 0;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    return Math.round(
      (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
  };

  const numberOfDays = calculateDays();

  const totalPrice =
    car && numberOfDays > 0
      ? Number(car.pricePerDay) * numberOfDays
      : 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!startDate || !endDate) {
      setError("Please select both dates.");
      return;
    }

    if (startDate < getToday()) {
      setError("Pickup date cannot be in the past.");
      return;
    }

    if (numberOfDays <= 0) {
      setError("Return date must be after pickup date.");
      return;
    }

    if (checkingAvailability) {
      setError("Please wait while availability is checked.");
      return;
    }

    if (!isAvailable) {
      setError(
        "This car is unavailable for the selected dates. Please choose different dates."
      );
      return;
    }

    if (!id) {
      setError("Invalid car ID.");
      return;
    }

    setBooking(true);

    try {
      // The backend validates inventory again when creating a booking.
      const response = await api.post("/bookings", {
        carId: Number(id),
        startDate,
        endDate,
      });

      navigate(`/payment/${response.data.id}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const responseData = err.response?.data as
          | { message?: string; error?: string }
          | undefined;

        setError(
          responseData?.message ||
            responseData?.error ||
            "Unable to create booking. The car may have just been booked by someone else."
        );
      } else {
        setError("Unable to create booking.");
      }
    } finally {
      setBooking(false);
    }
  };

  if (!id) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-600">Invalid car ID.</p>

        <Link
          to="/cars"
          className="mt-5 inline-block text-blue-600"
        >
          Back to Cars
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        Loading...
      </div>
    );
  }

  if (!car) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-600">
          {error || "Car not found."}
        </p>

        <Link
          to="/cars"
          className="mt-5 inline-block text-blue-600"
        >
          Back to Cars
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        to={`/cars/${car.id}`}
        state={{ startDate, endDate }}
        className="text-sm font-semibold text-blue-600 hover:underline"
      >
        ← Back to Car
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-slate-800">
            Book Your Car
          </h1>

          <p className="mt-2 text-slate-500">
            {car.brand} {car.model}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mt-8">
              <label
                htmlFor="startDate"
                className="mb-2 block font-medium"
              >
                Start Date
              </label>

              <input
                id="startDate"
                type="date"
                value={startDate}
                min={getToday()}
                onChange={(event) => {
                  const newStartDate = event.target.value;

                  setStartDate(newStartDate);

                  if (endDate <= newStartDate) {
                    const nextDay = new Date(
                      `${newStartDate}T12:00:00`
                    );

                    nextDay.setDate(nextDay.getDate() + 1);

                    const year = nextDay.getFullYear();
                    const month = String(
                      nextDay.getMonth() + 1
                    ).padStart(2, "0");
                    const day = String(
                      nextDay.getDate()
                    ).padStart(2, "0");

                    setEndDate(`${year}-${month}-${day}`);
                  }
                }}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="endDate"
                className="mb-2 block font-medium"
              >
                End Date
              </label>

              <input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate || getToday()}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            {checkingAvailability && (
              <p className="mt-4 text-sm text-slate-500">
                Checking availability for these dates...
              </p>
            )}

            {!checkingAvailability && !invalidDates && (
              <p
                className={`mt-4 text-sm font-medium ${
                  isAvailable
                    ? "text-green-700"
                    : "text-red-600"
                }`}
              >
                {isAvailable
                  ? "This car is available for your dates."
                  : "This car is not available for your dates."}
              </p>
            )}

            {error && (
              <div className="mt-5 rounded-lg bg-red-100 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                booking ||
                checkingAvailability ||
                !isAvailable ||
                numberOfDays <= 0
              }
              className="mt-8 w-full rounded-lg bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {booking
                ? "Creating Booking..."
                : checkingAvailability
                  ? "Checking Availability..."
                  : "Continue to Payment"}
            </button>
          </form>
        </div>

        <div className="h-fit rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-slate-800">
            Booking Summary
          </h2>

          <div className="mt-6 space-y-4">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Vehicle</span>

              <span className="text-right font-semibold">
                {car.brand} {car.model}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                Price per day
              </span>

              <span className="font-semibold">
                ₹
                {Number(car.pricePerDay).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Pickup</span>

              <span className="font-semibold">
                {startDate || "-"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Return</span>

              <span className="font-semibold">
                {endDate || "-"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                Number of days
              </span>

              <span className="font-semibold">
                {numberOfDays > 0 ? numberOfDays : "-"}
              </span>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between gap-4">
                <span className="text-lg font-semibold">
                  Total
                </span>

                <span className="text-2xl font-bold text-blue-600">
                  ₹{totalPrice.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Booking;