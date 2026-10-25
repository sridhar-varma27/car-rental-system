import { useEffect, useState } from "react";
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

function CarDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedDates = (location.state ?? {}) as RentalDates;

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] =
    useState(true);
  const [isAvailableForDates, setIsAvailableForDates] =
    useState(false);

  const [startDate] = useState(
    selectedDates.startDate || getToday()
  );
  const [endDate] = useState(
    selectedDates.endDate || getTomorrow()
  );

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
        setIsAvailableForDates(false);
        setCheckingAvailability(false);
        return;
      }

      try {
        const response = await api.get<Car[]>("/cars/available", {
          params: {
            startDate,
            endDate,
          },
        });

        if (active) {
          setIsAvailableForDates(
            response.data.some(
              (availableCar) =>
                String(availableCar.id) === id &&
                availableCar.available &&
                (availableCar.quantity ?? 0) > 0
            )
          );
        }
      } catch {
        if (active) {
          setIsAvailableForDates(false);
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

  const handleBooking = () => {
    if (checkingAvailability || !isAvailableForDates) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login", {
        state: {
          from: `/cars/${id}/book`,
          startDate,
          endDate,
        },
      });

      return;
    }

    navigate(`/cars/${id}/book`, {
      state: {
        startDate,
        endDate,
      },
    });
  };

  if (!id) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-lg text-red-600">
          Invalid car ID.
        </p>

        <Link
          to="/cars"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          Back to Cars
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-slate-600">
          Loading car details...
        </p>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-lg text-red-600">
          {error || "Car not found."}
        </p>

        <Link
          to="/cars"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          Back to Cars
        </Link>
      </div>
    );
  }

  const availabilityLabel = checkingAvailability
    ? "Checking availability..."
    : isAvailableForDates
      ? "Available for selected dates"
      : "Unavailable for selected dates";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/cars"
        state={{ startDate, endDate }}
        className="text-sm font-semibold text-blue-600 hover:underline"
      >
        ← Back to Cars
      </Link>

      <div className="mt-6 grid gap-8 overflow-hidden rounded-2xl bg-white shadow-lg md:grid-cols-2">
        <div className="h-80 bg-slate-200 md:h-full">
          {car.imageUrl ? (
            <img
              src={car.imageUrl}
              alt={`${car.brand} ${car.model}`}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No Image Available
            </div>
          )}
        </div>

        <div className="p-8">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              !checkingAvailability && isAvailableForDates
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {availabilityLabel}
          </span>

          <h1 className="mt-4 text-4xl font-bold text-slate-800">
            {car.brand} {car.model}
          </h1>

          <p className="mt-2 text-lg text-slate-500">
            {car.category}
          </p>

          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              Pickup and return dates
            </p>

            <p className="mt-2 font-semibold text-blue-900">
              {startDate} → {endDate}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Fuel Type
              </p>

              <p className="mt-1 font-semibold">
                {car.fuelType}
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Transmission
              </p>

              <p className="mt-1 font-semibold">
                {car.transmission}
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Seats
              </p>

              <p className="mt-1 font-semibold">
                {car.seatingCapacity}
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Price
              </p>

              <p className="mt-1 font-semibold">
                ₹
                {Number(car.pricePerDay).toLocaleString("en-IN")}
                /day
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-3xl font-bold text-slate-800">
              ₹
              {Number(car.pricePerDay).toLocaleString("en-IN")}
              <span className="text-base font-normal text-slate-500">
                {" "}
                / day
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleBooking}
            disabled={
              checkingAvailability ||
              invalidDates ||
              !isAvailableForDates
            }
            className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {checkingAvailability
              ? "Checking Availability..."
              : isAvailableForDates
                ? "Book This Car"
                : "Currently Unavailable"}
          </button>

          {!checkingAvailability &&
            !isAvailableForDates && (
              <p className="mt-3 text-center text-sm text-slate-500">
                This car has no available units for your selected
                rental dates. Please choose different dates.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

export default CarDetails;