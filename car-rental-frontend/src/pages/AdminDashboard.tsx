import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

import api from "../services/api";
import type { Booking, Car } from "../types";

function AdminDashboard() {
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [carsResponse, bookingsResponse] =
          await Promise.all([
            api.get<Car[]>("/cars"),
            api.get<Booking[]>("/admin/bookings"),
          ]);

        setCars(carsResponse.data);
        setBookings(bookingsResponse.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          setError(
            error.response?.data?.error ||
              "Unable to load dashboard data. Please check your admin login."
          );
        } else {
          setError("Unable to load dashboard data.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const availableCars = cars.filter(
    (car) => car.available
  ).length;

  const pendingBookings = bookings.filter(
    (booking) => booking.status === "PENDING"
  ).length;

  const confirmedBookings = bookings.filter(
    (booking) => booking.status === "CONFIRMED"
  ).length;

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === "CANCELLED"
  ).length;

  const recentBookings = [...bookings]
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
    )
    .slice(0, 5);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-600">
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Admin Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Monitor your car inventory and rental bookings.
          </p>
        </div>

        <Link
          to="/cars"
          className="rounded-lg bg-slate-800 px-5 py-3 text-center font-semibold text-white hover:bg-slate-700"
        >
          View Customer Site
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-red-100 p-4 text-red-700">
          {error}
        </div>
      )}

      {!error && (
        <>
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Cars"
              value={cars.length}
              description="Vehicles in inventory"
              color="blue"
            />

            <StatCard
              title="Available Cars"
              value={availableCars}
              description="Vehicles marked available"
              color="green"
            />

            <StatCard
              title="Total Bookings"
              value={bookings.length}
              description="All rental bookings"
              color="purple"
            />

            <StatCard
              title="Pending Bookings"
              value={pendingBookings}
              description="Awaiting payment or confirmation"
              color="yellow"
            />

            <StatCard
              title="Confirmed Bookings"
              value={confirmedBookings}
              description="Successfully paid bookings"
              color="green"
            />

            <StatCard
              title="Cancelled Bookings"
              value={cancelledBookings}
              description="Cancelled reservations"
              color="red"
            />
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="text-xl font-bold text-slate-800">
                Car Management
              </h2>

              <p className="mt-2 text-slate-500">
                Add vehicles, update prices, and manage availability.
              </p>

              <Link
                to="/admin/cars"
                className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Manage Cars
              </Link>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="text-xl font-bold text-slate-800">
                Booking Management
              </h2>

              <p className="mt-2 text-slate-500">
                Review customer reservations and update booking statuses.
              </p>

              <Link
                to="/admin/bookings"
                className="mt-5 inline-block rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700"
              >
                Manage Bookings
              </Link>
            </div>
          </section>

          <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-800">
                Recent Bookings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                The five most recently created bookings.
              </p>
            </div>

            {recentBookings.length === 0 ? (
              <p className="p-8 text-center text-slate-500">
                No bookings have been created yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-6 py-4">Booking ID</th>
                      <th className="px-6 py-4">Vehicle</th>
                      <th className="px-6 py-4">Rental Period</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {recentBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-6 py-4 font-semibold">
                          #{booking.id}
                        </td>

                        <td className="px-6 py-4">
                          {booking.carBrand} {booking.carModel}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          {booking.startDate} – {booking.endDate}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 font-semibold">
                          ₹{booking.totalPrice}
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-200 p-5">
              <Link
                to="/admin/bookings"
                className="font-semibold text-blue-600 hover:underline"
              >
                View all bookings →
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  color: "blue" | "green" | "purple" | "yellow" | "red";
}

function StatCard({
  title,
  value,
  description,
  color,
}: StatCardProps) {
  const colorClasses: Record<StatCardProps["color"], string> = {
    blue: "border-blue-500",
    green: "border-green-500",
    purple: "border-purple-500",
    yellow: "border-yellow-500",
    red: "border-red-500",
  };

  return (
    <div
      className={`rounded-2xl border-l-4 ${colorClasses[color]} bg-white p-6 shadow-md`}
    >
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-slate-800">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default AdminDashboard;