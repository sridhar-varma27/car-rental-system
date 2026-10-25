
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../services/api";
import type { Booking, Payment as PaymentData } from "../types";

interface RazorpayOrderResponse {
  bookingId: number;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
}

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: string,
    callback: (response: { error?: { description?: string } }) => void
  ) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existingScript.addEventListener("error", () => resolve(false), {
        once: true,
      });

      if (window.Razorpay) {
        resolve(true);
      }

      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: { message?: string; error?: string };
        };
      }
    ).response;

    return (
      response?.data?.message ??
      response?.data?.error ??
      fallback
    );
  }

  return fallback;
}

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [paymentCheckFailed, setPaymentCheckFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBookingAndPayment() {
      if (!bookingId || !/^\d+$/.test(bookingId)) {
        setError("Invalid booking ID.");
        setLoading(false);
        return;
      }

      try {
        const bookingResponse = await api.get<Booking>(
          `/bookings/${bookingId}`
        );

        if (!active) return;

        setBooking(bookingResponse.data);

        try {
          const paymentResponse = await api.get<PaymentData>(
            `/payments/booking/${bookingId}`
          );

          if (!active) return;

          if (paymentResponse.data.status === "SUCCESS") {
            navigate(`/confirmation/${bookingId}`, { replace: true });
            return;
          }

          // Pending or failed payments can be retried.
          // The backend creates a new order for the retry.
        } catch (paymentError: unknown) {
          const status = (
            paymentError as {
              response?: { status?: number };
            }
          )?.response?.status;

          if (status !== 404) {
            if (!active) return;

            setPaymentCheckFailed(true);
            setError(
              "Unable to check your payment status. Please refresh and try again."
            );
            return;
          }
        }
      } catch (bookingError: unknown) {
        if (!active) return;

        setError(
          getErrorMessage(bookingError, "Unable to load booking details.")
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBookingAndPayment();

    return () => {
      active = false;
    };
  }, [bookingId, navigate]);

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!booking || !bookingId || processing || paymentCheckFailed) {
      return;
    }

    setError("");
    setProcessing(true);

    try {
      // Recheck payment before creating another order.
      try {
        const existingPayment = await api.get<PaymentData>(
          `/payments/booking/${bookingId}`
        );

        if (existingPayment.data.status === "SUCCESS") {
          navigate(`/confirmation/${bookingId}`, { replace: true });
          return;
        }
      } catch (paymentError: unknown) {
        const status = (
          paymentError as {
            response?: { status?: number };
          }
        )?.response?.status;

        if (status !== 404) {
          throw new Error(
            "Unable to check the current payment status.",
            { cause: paymentError }
          );
        }
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay Checkout. Check your internet connection and try again."
        );
      }

      const orderResponse = await api.post<RazorpayOrderResponse>(
        "/payments",
        {
          bookingId: Number(bookingId),
          paymentMethod,
        }
      );

      const order = orderResponse.data;

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Car Rental System",
        description: `Payment for booking #${bookingId}`,
        order_id: order.orderId,
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
        handler: async (response) => {
          try {
            setError("");

            const verificationResponse =
              await api.post<PaymentData>("/payments/verify", {
                bookingId: Number(bookingId),
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

            if (verificationResponse.data.status === "SUCCESS") {
              navigate(`/confirmation/${bookingId}`, {
                replace: true,
              });
              return;
            }

            setError(
              "Payment verification is incomplete. Do not pay again yet; refresh the page and check the payment status."
            );
          } catch (verificationError: unknown) {
            setError(
              getErrorMessage(
                verificationError,
                "We could not verify your payment. Refresh the page to check its status before retrying."
              )
            );
          } finally {
            setProcessing(false);
          }
        },
      });

      checkout.on("payment.failed", (response) => {
        setError(
          response.error?.description ??
            "Payment failed. You can try again."
        );
        setProcessing(false);
      });

      checkout.open();
    } catch (paymentError: unknown) {
      setError(
        getErrorMessage(
          paymentError,
          paymentError instanceof Error
            ? paymentError.message
            : "Unable to start payment."
        )
      );
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        Loading booking details...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-600">
          {error || "Booking details could not be loaded."}
        </p>
        <Link
          to="/bookings"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Payment</h1>
        <p className="mt-2 text-gray-600">
          Complete your booking securely with Razorpay.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-5 text-xl font-semibold text-gray-900">
            Payment Details
          </h2>

          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="font-medium text-blue-900">
              Razorpay Test Mode
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Use Razorpay's test credentials. No real payment should be
              made while testing.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handlePayment} className="space-y-6">
            <div>
              <label
                htmlFor="paymentMethod"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Preferred Payment Method
              </label>

              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                disabled={processing || paymentCheckFailed}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="UPI">UPI</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="NET_BANKING">Net Banking</option>
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Choose your preference here. Available payment options
                are presented in Razorpay Checkout.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Amount payable
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                ₹{Number(booking.totalPrice).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            <button
              type="submit"
              disabled={processing || paymentCheckFailed}
              className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing
                ? "Processing..."
                : `Pay ₹${Number(booking.totalPrice).toLocaleString("en-IN")}`}
            </button>

            <p className="text-center text-xs text-gray-500">
              Your booking is confirmed only after the backend verifies
              the payment.
            </p>
          </form>
        </section>

        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-semibold text-gray-900">
            Booking Summary
          </h2>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Booking ID</span>
              <span className="font-medium text-gray-900">
                #{bookingId}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Vehicle</span>
              <span className="text-right font-medium text-gray-900">
                {String(
                  (booking as Booking & { carName?: string }).carName ??
                    "Rental vehicle"
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Pickup Date</span>
              <span className="text-right text-gray-900">
                {String(booking.startDate)}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Return Date</span>
              <span className="text-right text-gray-900">
                {String(booking.endDate)}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Rental Days</span>
              <span className="text-gray-900">
                {String(booking.numberOfDays)}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Price per Day</span>
              <span className="text-gray-900">
                ₹{Number(booking.pricePerDay).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-gray-900">
                  Total
                </span>
                <span className="font-bold text-gray-900">
                  ₹{Number(booking.totalPrice).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/bookings"
            className="mt-6 inline-block text-sm text-blue-600 hover:underline"
          >
            Back to My Bookings
          </Link>
        </aside>
      </div>
    </div>
  );
}
