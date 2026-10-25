
import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";

interface ConfirmationData {
  bookingId: number;
  customerName: string;
  customerEmail: string;
  car: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  pricePerDay: number;
  totalPrice: number;
  bookingStatus: string;
  paymentStatus: string;
  transactionId: string;
}

function Confirmation() {
  const { bookingId } = useParams();

  const [confirmation, setConfirmation] =
    useState<ConfirmationData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchConfirmation = async () => {
      setLoading(true);
      setError("");

      try {
        if (!bookingId) {
          setError("Booking ID is missing.");
          return;
        }

        const response = await api.get<ConfirmationData>(
          `/confirmations/${bookingId}`
        );

        if (active) {
          setConfirmation(response.data);
        }
      } catch (requestError) {
        if (!active) return;

        if (axios.isAxiosError(requestError)) {
          setError(
            requestError.response?.data?.error ||
              requestError.response?.data?.message ||
              "Unable to load confirmation."
          );
        } else {
          setError("Unable to load confirmation.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchConfirmation();

    return () => {
      active = false;
    };
  }, [bookingId]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-slate-600">
          Loading confirmation...
        </p>
      </div>
    );
  }

  if (!confirmation) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-lg text-red-600">
          {error || "Confirmation not found."}
        </p>

        <Link
          to="/my-bookings"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          View My Bookings
        </Link>
      </div>
    );
  }

  const paymentStatus = (
    confirmation.paymentStatus || "UNKNOWN"
  ).toUpperCase();

  const bookingStatus = (
    confirmation.bookingStatus || "UNKNOWN"
  ).toUpperCase();

  const isPaid = paymentStatus === "SUCCESS";
  const isRefunded = paymentStatus === "REFUNDED";
  const isCancelled = bookingStatus === "CANCELLED";

  const paymentStatusClass = isPaid
    ? "bg-green-100 text-green-700"
    : isRefunded
      ? "bg-purple-100 text-purple-700"
      : "bg-amber-100 text-amber-700";

  const bookingStatusClass =
    bookingStatus === "CONFIRMED"
      ? "bg-green-100 text-green-700"
      : bookingStatus === "COMPLETED"
        ? "bg-blue-100 text-blue-700"
        : bookingStatus === "CANCELLED"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
              isPaid
                ? "bg-green-100 text-green-600"
                : isRefunded
                  ? "bg-purple-100 text-purple-600"
                  : "bg-amber-100 text-amber-600"
            }`}
          >
            {isPaid ? "✓" : isRefunded ? "↩" : "!"}
          </div>

          <h1 className="mt-5 text-3xl font-bold text-slate-800">
            {isPaid
              ? isCancelled
                ? "Payment Receipt"
                : "Booking Confirmation"
              : isRefunded
                ? "Payment Refunded"
                : "Booking Details"}
          </h1>

          <p className="mt-2 text-slate-500">
            {isPaid
              ? "Your successful payment record is available below."
              : isRefunded
                ? "This payment has been marked as refunded."
                : "Your booking details are available below. Payment has not been confirmed as successful."}
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">
              Booking ID
            </p>

            <p className="mt-1 text-lg font-bold">
              #{confirmation.bookingId}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">
              Customer
            </p>

            <p className="mt-1 font-semibold">
              {confirmation.customerName}
            </p>

            <p className="text-sm text-slate-500">
              {confirmation.customerEmail}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">
              Vehicle
            </p>

            <p className="mt-1 text-lg font-semibold">
              {confirmation.car}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">
              Rental Period
            </p>

            <p className="mt-1 font-semibold">
              {confirmation.startDate}
              {" → "}
              {confirmation.endDate}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t pt-8">
          <h2 className="text-xl font-bold text-slate-800">
            Booking and Payment Details
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Booking Status
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${bookingStatusClass}`}
              >
                {bookingStatus}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Number of Days
              </span>

              <span className="font-semibold">
                {confirmation.numberOfDays}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Price Per Day
              </span>

              <span className="font-semibold">
                ₹{confirmation.pricePerDay}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Payment Status
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${paymentStatusClass}`}
              >
                {paymentStatus}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="text-slate-500">
                Transaction ID
              </span>

              <span className="break-all text-right font-mono text-sm">
                {confirmation.transactionId || "Not available"}
              </span>
            </div>

            <div className="border-t pt-5">
              <div className="flex justify-between gap-4">
                <span className="text-xl font-bold">
                  {isPaid ? "Total Paid" : "Booking Total"}
                </span>

                <span
                  className={`text-3xl font-bold ${
                    isPaid
                      ? "text-green-600"
                      : "text-slate-700"
                  }`}
                >
                  ₹{confirmation.totalPrice}
                </span>
              </div>

              {!isPaid && (
                <p className="mt-3 text-sm text-slate-500">
                  {isRefunded
                    ? "The amount above is the booking total, not a confirmation of the refund amount."
                    : "This amount is the booking total, not proof of a completed payment."}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/my-bookings"
            className="flex-1 rounded-lg bg-blue-600 px-5 py-3 text-center font-semibold text-white hover:bg-blue-700"
          >
            View My Bookings
          </Link>

          <Link
            to="/cars"
            className="flex-1 rounded-lg bg-slate-200 px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-300"
          >
            Rent Another Car
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Confirmation;
