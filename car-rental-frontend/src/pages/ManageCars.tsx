import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { FormEvent, ChangeEvent } from "react";

import api from "../services/api";
import type { Car } from "../types";

type CarFormData = {
  brand: string;
  model: string;
  category: string;
  pricePerDay: string;
  fuelType: string;
  transmission: string;
  seatingCapacity: string;
  quantity: string;
  imageUrl: string;
  available: boolean;
};

const emptyForm: CarFormData = {
  brand: "",
  model: "",
  category: "SUV",
  pricePerDay: "",
  fuelType: "Petrol",
  transmission: "Automatic",
  seatingCapacity: "5",
  quantity: "1",
  imageUrl: "",
  available: true,
};

const CATEGORY_ORDER = [
  "Hatchback",
  "Sedan",
  "SUV",
  "Luxury",
  "Sports",
  "Van",
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ||
      error.response?.data?.message ||
      fallback
    );
  }

  return fallback;
}

function ManageCars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [form, setForm] = useState<CarFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestCars = useCallback(async () => {
    const response = await api.get<Car[]>("/cars");
    return response.data;
  }, []);

  const refreshCars = async () => {
    const data = await requestCars();
    setCars(data);
  };

  useEffect(() => {
    let active = true;

    const loadCars = async () => {
      try {
        const data = await requestCars();

        if (active) {
          setCars(data);
          setError("");
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            getErrorMessage(
              err,
              "Unable to load cars. Check your admin login."
            )
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadCars();

    return () => {
      active = false;
    };
  }, [requestCars]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (car: Car) => {
    setForm({
      brand: car.brand,
      model: car.model,
      category: car.category,
      pricePerDay: String(car.pricePerDay),
      fuelType: car.fuelType,
      transmission: car.transmission,
      seatingCapacity: String(car.seatingCapacity),
      quantity: String(car.quantity ?? 1),
      imageUrl: car.imageUrl || "",
      available: car.available,
    });

    setEditingId(car.id);
    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const price = Number(form.pricePerDay);
    const seats = Number(form.seatingCapacity);
    const quantity = Number(form.quantity);

    if (!Number.isFinite(price) || price <= 0) {
      setError("Price per day must be greater than zero.");
      return;
    }

    if (!Number.isInteger(seats) || seats < 1) {
      setError("Seating capacity must be at least 1.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a whole number of at least 1.");
      return;
    }

    const payload = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      category: form.category,
      pricePerDay: price,
      fuelType: form.fuelType,
      transmission: form.transmission,
      seatingCapacity: seats,
      quantity,
      imageUrl: form.imageUrl.trim(),
      available: form.available,
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        await api.put(`/cars/${editingId}`, payload);
        setSuccess("Car details and inventory quantity updated.");
      } else {
        await api.post("/cars", payload);
        setSuccess("Car added successfully.");
      }

      resetForm();
      await refreshCars();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to save car details. Make sure you are logged in as an admin."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (car: Car) => {
    setError("");
    setSuccess("");
    setTogglingId(car.id);

    try {
      const newAvailability = !car.available;

      await api.patch(`/cars/${car.id}/availability`, null, {
        params: { available: newAvailability },
      });

      await refreshCars();

      setSuccess(
        `${car.brand} ${car.model} is now ${
          newAvailability ? "enabled" : "disabled"
        }.`
      );
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to update car availability. Check your admin login and backend endpoint."
        )
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (car: Car) => {
    const confirmed = window.confirm(
      `Delete ${car.brand} ${car.model}? This may be restricted if the car has bookings.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/cars/${car.id}`);

      if (editingId === car.id) {
        resetForm();
      }

      await refreshCars();
      setSuccess("Car deleted successfully.");
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to delete this car. It may have existing bookings."
        )
      );
    }
  };

  const totalUnits = cars.reduce(
    (total, car) => total + Math.max(1, car.quantity ?? 1),
    0
  );

  // Sort inventory by category, then brand and model.
  // Unknown categories appear after the listed categories.
  const sortedCars = [...cars].sort((a, b) => {
    const categoryA = CATEGORY_ORDER.indexOf(a.category);
    const categoryB = CATEGORY_ORDER.indexOf(b.category);

    const orderA =
      categoryA === -1 ? CATEGORY_ORDER.length : categoryA;
    const orderB =
      categoryB === -1 ? CATEGORY_ORDER.length : categoryB;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const brandComparison = a.brand.localeCompare(b.brand);

    if (brandComparison !== 0) {
      return brandComparison;
    }

    return a.model.localeCompare(b.model);
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">
          Manage Cars
        </h1>
        <p className="mt-2 text-slate-500">
          Manage car models, fleet quantities, prices, and availability.
        </p>
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

      <section className="mb-10 rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">
            {editingId !== null ? "Edit Car" : "Add New Car"}
          </h2>

          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="brand"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Brand
              </label>
              <input
                id="brand"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                required
                maxLength={100}
                placeholder="e.g. Toyota"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="model"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Model
              </label>
              <input
                id="model"
                name="model"
                value={form.model}
                onChange={handleChange}
                required
                maxLength={100}
                placeholder="e.g. Camry"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Luxury">Luxury</option>
                <option value="Sports">Sports</option>
                <option value="Van">Van</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pricePerDay"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Price per Day (₹)
              </label>
              <input
                id="pricePerDay"
                name="pricePerDay"
                type="number"
                min="0.01"
                step="0.01"
                value={form.pricePerDay}
                onChange={handleChange}
                required
                placeholder="e.g. 2500"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="fuelType"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Fuel Type
              </label>
              <select
                id="fuelType"
                name="fuelType"
                value={form.fuelType}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
                <option value="CNG">CNG</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="transmission"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Transmission
              </label>
              <select
                id="transmission"
                name="transmission"
                value={form.transmission}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="seatingCapacity"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Seating Capacity
              </label>
              <input
                id="seatingCapacity"
                name="seatingCapacity"
                type="number"
                min="1"
                step="1"
                value={form.seatingCapacity}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Fleet Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Total physical units of this model.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="imageUrl"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Image URL (optional)
              </label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                value={form.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/car.jpg"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="available"
                name="available"
                type="checkbox"
                checked={form.available}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    available: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              <label
                htmlFor="available"
                className="text-sm font-medium text-slate-700"
              >
                Enable this car model for rental
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId !== null
                ? "Update Car"
                : "Add Car"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">
            Vehicle Inventory
          </h2>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {cars.length} Models
            </span>
            <span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700">
              {totalUnits} Total Units
            </span>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-slate-500">
            Loading vehicles...
          </p>
        ) : cars.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center shadow">
            <p className="text-slate-600">
              No cars found. Add your first vehicle above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="w-full min-w-[950px] text-left">
              <thead className="bg-slate-100 text-sm text-slate-600">
                <tr>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Price / Day</th>
                  <th className="px-5 py-4">Fuel</th>
                  <th className="px-5 py-4">Fleet Quantity</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {sortedCars.map((car) => (
                  <tr key={car.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {car.brand} {car.model}
                      </p>
                      <p className="text-sm text-slate-500">
                        {car.seatingCapacity} seats · {car.transmission}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {car.category}
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-800">
                      ₹{Number(car.pricePerDay).toLocaleString("en-IN")}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {car.fuelType}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {car.quantity ?? 1} units
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          car.available
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {car.available ? "Enabled" : "Disabled"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(car)}
                          className="rounded-md bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(car)}
                          disabled={togglingId === car.id}
                          className="rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {togglingId === car.id
                            ? "Updating..."
                            : car.available
                              ? "Disable"
                              : "Enable"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(car)}
                          className="rounded-md bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
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

export default ManageCars;