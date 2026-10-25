
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import api from "../services/api";
import type { Booking } from "../types";

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;

type BookingStatus = (typeof BOOKING_STATUSES)[number];

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined;

    return data?.message || data?.error || fallback;
  }

  return fallback;
}

function ManageBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadBookings = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const response = await api.get<Booking[]>("/admin/bookings");

    if (mountedRef.current && requestId === requestIdRef.current) {
      setBookings(response.data);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      try {
        await loadBookings();

        if (mountedRef.current) {
          setError("");
        }
      } catch (err: unknown) {
        if (mountedRef.current) {
          setError(
            getErrorMessage(
              err,
              "Unable to load bookings. Check your admin login."
            )
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        booking.status.toUpperCase() === statusFilter;

      const matchesSearch =
        !term ||
        String(booking.id).includes(term) ||
        String(booking.userId).includes(term) ||
        String(booking.carId).includes(term) ||
        `${booking.carBrand} ${booking.carModel}`
          .toLowerCase()
          .includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [bookings, search, statusFilter]);

  const handleStatusChange = async (
    booking: Booking,
    newStatus: BookingStatus
  ) => {
    if (
      booking.status.toUpperCase() === newStatus ||
      updatingId !== null
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingId(booking.id);

    try {
      await api.patch(
        `/admin/bookings/${booking.id}/status`,
        null,
        { params: { status: newStatus } }
      );

      if (!mountedRef.current) {
        return;
      }

      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? { ...item, status: newStatus }
            : item
        )
      );

      setSuccess(
        `Booking #${booking.id} status updated to ${newStatus}.`
      );

      try {
        await loadBookings();

        if (mountedRef.current) {
          setError("");
        }
      } catch (refreshError: unknown) {
        if (mountedRef.current) {
          setError(
            `Booking #${booking.id} was updated, but the list could not be refreshed. ${getErrorMessage(
              refreshError,
              "Please use Refresh Bookings to reload the latest data."
            )}`
          );
        }
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(
          getErrorMessage(
            err,
            `Unable to update booking #${booking.id}.`
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        setUpdatingId(null);
      }
    }
  };

  const formatDate = (value: string) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);

  const statusClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONFIRMED":
        return "bg-green-100 text-green-700";
      case "PENDING":
        return "bg-amber-100 text-amber-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      case "COMPLETED":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await loadBookings();

      if (mountedRef.current) {
        setError("");
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(
          getErrorMessage(err, "Unable to refresh bookings.")
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const countStatus = (status: BookingStatus) =>
    bookings.filter(
      (booking) => booking.status.toUpperCase() === status
    ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Manage Bookings
          </h1>
          <p className="mt-2 text-slate-500">
            View customer reservations and manage booking statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading || updatingId !== null}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Bookings"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg bg-red-100 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-lg bg-green-100 p-4 text-green-700"
        >
          {success}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Total Bookings</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {bookings.length}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {countStatus("PENDING")}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Confirmed</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {countStatus("CONFIRMED")}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Cancelled</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {countStatus("CANCELLED")}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {countStatus("COMPLETED")}
          </p>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="booking-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Search bookings
            </label>
            <input
              id="booking-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Booking ID, user ID, car or model"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="status-filter"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="ALL">All statuses</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </div>

        {loading ? (
          <p className="py-10 text-center text-slate-500">
            Loading bookings...
          </p>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-10 text-center">
            <p className="font-semibold text-slate-700">
              No bookings found
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your search or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="bg-slate-100 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-4">Booking</th>
                  <th className="px-4 py-4">Customer ID</th>
                  <th className="px-4 py-4">Vehicle</th>
                  <th className="px-4 py-4">Rental Dates</th>
                  <th className="px-4 py-4">Days</th>
                  <th className="px-4 py-4">Total</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Update Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      #{booking.id}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      #{booking.userId}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-800">
                        {booking.carBrand} {booking.carModel}
                      </p>
                      <p className="text-sm text-slate-500">
                        Car ID: {booking.carId}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      <p>{formatDate(booking.startDate)}</p>
                      <p className="mt-1">
                        to {formatDate(booking.endDate)}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {booking.numberOfDays}
                    </td>

                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {formatCurrency(booking.totalPrice)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          booking.status
                        )}`}
                      >
                        {booking.status}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <select
                        aria-label={`Update status for booking ${booking.id}`}
                        value={booking.status.toUpperCase()}
                        disabled={updatingId !== null}
                        onChange={(event) => {
                          const value = event.target.value;

                          if (
                            BOOKING_STATUSES.some(
                              (status) => status === value
                            )
                          ) {
                            void handleStatusChange(
                              booking,
                              value as BookingStatus
                            );
                          }
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        {BOOKING_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      {updatingId === booking.id && (
                        <p className="mt-1 text-xs text-slate-500">
                          Updating...
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default ManageBookings;
