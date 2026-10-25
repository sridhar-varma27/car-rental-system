import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

import api from "../services/api";
import type { Booking } from "../types";

function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchBookings = useCallback(async () => {
    const response = await api.get<Booking[]>("/bookings");
    setBookings(response.data);
  }, []);

  useEffect(() => {
    let active = true;

    const loadBookings = async () => {
      try {
        const response = await api.get<Booking[]>("/bookings");

        if (active) {
          setBookings(response.data);
          setError("");
        }
      } catch (error) {
        if (active) {
          if (axios.isAxiosError(error)) {
            setError(
              error.response?.data?.error ||
                "Unable to load your bookings."
            );
          } else {
            setError("Unable to load your bookings.");
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadBookings();

    return () => {
      active = false;
    };
  }, []);

  const handleCancel = async (bookingId: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setCancellingId(bookingId);

    try {
      await api.patch(`/bookings/${bookingId}/cancel`);
      await fetchBookings();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.error ||
            "Unable to cancel booking."
        );
      } else {
        setError("Unable to cancel booking.");
      }
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-700";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      case "COMPLETED":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-slate-600">
          Loading your bookings...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            My Bookings
          </h1>
          <p className="mt-2 text-slate-500">
            View and manage your car rental bookings.
          </p>
        </div>

        <Link
          to="/cars"
          className="rounded-lg bg-blue-600 px-5 py-3 text-center font-semibold text-white hover:bg-blue-700"
        >
          Book Another Car
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-red-100 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-12 text-center shadow">
          <h2 className="text-2xl font-bold text-slate-800">
            No Bookings Yet
          </h2>
          <p className="mt-2 text-slate-500">
            You haven't booked a car yet.
          </p>
          <Link
            to="/cars"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Browse Cars
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="overflow-hidden rounded-2xl bg-white shadow-md"
            >
              <div className="border-b border-slate-200 p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm text-slate-500">
                      Booking #{booking.id}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-800">
                      {booking.carBrand} {booking.carModel}
                    </h2>
                  </div>

                  <span
                    className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${getStatusClass(
                      booking.status
                    )}`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-slate-500">Start Date</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {booking.startDate}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">End Date</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {booking.endDate}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Rental Duration
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {booking.numberOfDays}{" "}
                    {booking.numberOfDays === 1 ? "day" : "days"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Total Price</p>
                  <p className="mt-1 text-xl font-bold text-blue-600">
                    ₹{booking.totalPrice}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-6 sm:flex-row sm:justify-end">
                {(booking.status === "PENDING" ||
                  booking.status === "CONFIRMED") && (
                  <button
                    type="button"
                    onClick={() => handleCancel(booking.id)}
                    disabled={cancellingId === booking.id}
                    className="rounded-lg bg-red-500 px-5 py-3 font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancellingId === booking.id
                      ? "Cancelling..."
                      : "Cancel Booking"}
                  </button>
                )}

                {booking.status === "PENDING" && (
                  <Link
                    to={`/payment/${booking.id}`}
                    className="rounded-lg bg-green-600 px-5 py-3 text-center font-semibold text-white hover:bg-green-700"
                  >
                    Continue to Payment
                  </Link>
                )}

                {booking.status === "CONFIRMED" && (
                  <Link
                    to={`/confirmation/${booking.id}`}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-center font-semibold text-white hover:bg-blue-700"
                  >
                    View Confirmation
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyBookings;