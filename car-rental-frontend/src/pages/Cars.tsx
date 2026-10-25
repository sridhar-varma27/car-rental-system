
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import api from "../services/api";
import type { Car } from "../types";

type CarWithAvailability = Car & {
  availableQuantity?: number;
  imageUrl?: string;
  image?: string;
};

type SortOption = "recommended" | "price-low" | "price-high" | "name";

const CATEGORY_ORDER = [
  "Hatchback",
  "Sedan",
  "SUV",
  "Luxury",
  "Sports",
  "Van",
];

// Change this URL to use another car image.
const CAR_HEADER_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=2000&q=85";

const getToday = () => {
  const date = new Date();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const getTomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDate = (date: string) => {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getCarImage = (car: CarWithAvailability) => {
  return car.imageUrl || car.image || CAR_HEADER_IMAGE;
};

function Cars() {
  const [cars, setCars] = useState<CarWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getTomorrow());

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("cars-theme") === "dark"
  );

  const [showFilters, setShowFilters] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [modelFilter, setModelFilter] = useState("All");
  const [fuelFilter, setFuelFilter] = useState("All");
  const [transmissionFilter, setTransmissionFilter] = useState("All");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");

  const [appliedFilters, setAppliedFilters] = useState({
    category: "All",
    brand: "All",
    model: "All",
    fuel: "All",
    transmission: "All",
    maxPrice: "",
  });

  // Synchronize the Cars page with the theme toggle in Navbar.tsx.
  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(localStorage.getItem("cars-theme") === "dark");
    };

    window.addEventListener("cars-theme-change", syncTheme);

    return () => {
      window.removeEventListener("cars-theme-change", syncTheme);
    };
  }, []);

  const validDates = Boolean(
    startDate &&
      endDate &&
      startDate >= getToday() &&
      endDate > startDate
  );

  const dateDuration =
    validDates && startDate && endDate
      ? Math.ceil(
          (new Date(`${endDate}T00:00:00`).getTime() -
            new Date(`${startDate}T00:00:00`).getTime()) /
            86400000
        )
      : 0;

  // Fetch available cars whenever the rental dates change.
  useEffect(() => {
    let cancelled = false;

    const fetchCars = async () => {
      if (!startDate || !endDate || endDate <= startDate) {
        setCars([]);
        setLoading(false);
        setError("Please select a valid pickup and return date.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api.get("/cars/available", {
          params: { startDate, endDate },
        });

        if (cancelled) return;

        const data = Array.isArray(response.data)
          ? response.data
          : [];

        setCars(
          data.filter(
            (car: CarWithAvailability) =>
              car.available !== false &&
              (car.availableQuantity ?? car.quantity ?? 0) > 0
          )
        );
      } catch (err) {
        if (cancelled) return;

        if (axios.isAxiosError(err)) {
          setError(
            typeof err.response?.data === "string"
              ? err.response.data
              : "Unable to load available cars. Please try again."
          );
        } else {
          setError("Unable to load available cars. Please try again.");
        }

        setCars([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchCars();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const brands = useMemo(
    () => [...new Set(cars.map((car) => car.brand).filter(Boolean))].sort(),
    [cars]
  );

  const models = useMemo(
    () => [...new Set(cars.map((car) => car.model).filter(Boolean))].sort(),
    [cars]
  );

  const fuelTypes = useMemo(
    () => [...new Set(cars.map((car) => car.fuelType).filter(Boolean))].sort(),
    [cars]
  );

  const transmissions = useMemo(
    () =>
      [
        ...new Set(cars.map((car) => car.transmission).filter(Boolean)),
      ].sort(),
    [cars]
  );

  const categories = useMemo(
    () => [...new Set(cars.map((car) => car.category).filter(Boolean))].sort(),
    [cars]
  );

  const filteredCars = useMemo(() => {
    let result = cars.filter((car) => {
      return (
        (appliedFilters.category === "All" ||
          car.category === appliedFilters.category) &&
        (appliedFilters.brand === "All" ||
          car.brand === appliedFilters.brand) &&
        (appliedFilters.model === "All" ||
          car.model === appliedFilters.model) &&
        (appliedFilters.fuel === "All" ||
          car.fuelType === appliedFilters.fuel) &&
        (appliedFilters.transmission === "All" ||
          car.transmission === appliedFilters.transmission) &&
        (!appliedFilters.maxPrice ||
          Number(car.pricePerDay) <= Number(appliedFilters.maxPrice))
      );
    });

    if (sortBy === "price-low") {
      result = [...result].sort(
        (a, b) => Number(a.pricePerDay) - Number(b.pricePerDay)
      );
    } else if (sortBy === "price-high") {
      result = [...result].sort(
        (a, b) => Number(b.pricePerDay) - Number(a.pricePerDay)
      );
    } else if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)
      );
    }

    return result;
  }, [cars, appliedFilters, sortBy]);

  const groupedCars = useMemo(() => {
    const groups: Record<string, CarWithAvailability[]> = {};

    for (const car of filteredCars) {
      const category = car.category || "Other";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(car);
    }

    return Object.entries(groups).sort(([a], [b]) => {
      const indexA = CATEGORY_ORDER.indexOf(a);
      const indexB = CATEGORY_ORDER.indexOf(b);

      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }

      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  }, [filteredCars]);

  const totalAvailable = filteredCars.reduce(
    (total, car) =>
      total + (car.availableQuantity ?? car.quantity ?? 0),
    0
  );

  const applyFilters = () => {
    setAppliedFilters({
      category: categoryFilter,
      brand: brandFilter,
      model: modelFilter,
      fuel: fuelFilter,
      transmission: transmissionFilter,
      maxPrice,
    });

    setShowFilters(false);
  };

  const clearFilters = () => {
    setCategoryFilter("All");
    setBrandFilter("All");
    setModelFilter("All");
    setFuelFilter("All");
    setTransmissionFilter("All");
    setMaxPrice("");

    setAppliedFilters({
      category: "All",
      brand: "All",
      model: "All",
      fuel: "All",
      transmission: "All",
      maxPrice: "",
    });

    setSortBy("recommended");
  };

  const activeFilters = [
    appliedFilters.category !== "All" && {
      label: `Category: ${appliedFilters.category}`,
      clear: () => {
        setCategoryFilter("All");
        setAppliedFilters((prev) => ({ ...prev, category: "All" }));
      },
    },
    appliedFilters.brand !== "All" && {
      label: `Brand: ${appliedFilters.brand}`,
      clear: () => {
        setBrandFilter("All");
        setAppliedFilters((prev) => ({ ...prev, brand: "All" }));
      },
    },
    appliedFilters.model !== "All" && {
      label: `Model: ${appliedFilters.model}`,
      clear: () => {
        setModelFilter("All");
        setAppliedFilters((prev) => ({ ...prev, model: "All" }));
      },
    },
    appliedFilters.fuel !== "All" && {
      label: `Fuel: ${appliedFilters.fuel}`,
      clear: () => {
        setFuelFilter("All");
        setAppliedFilters((prev) => ({ ...prev, fuel: "All" }));
      },
    },
    appliedFilters.transmission !== "All" && {
      label: `Transmission: ${appliedFilters.transmission}`,
      clear: () => {
        setTransmissionFilter("All");
        setAppliedFilters((prev) => ({
          ...prev,
          transmission: "All",
        }));
      },
    },
    appliedFilters.maxPrice && {
      label: `Max price: ₹${appliedFilters.maxPrice}/day`,
      clear: () => {
        setMaxPrice("");
        setAppliedFilters((prev) => ({ ...prev, maxPrice: "" }));
      },
    },
  ].filter(
    (
      filter
    ): filter is {
      label: string;
      clear: () => void;
    } => Boolean(filter)
  );

  const dark = isDarkMode;

  const pageClass = dark
    ? "min-h-screen bg-slate-950 text-slate-100"
    : "min-h-screen bg-slate-50 text-slate-900";

  const panelClass = dark
    ? "border-slate-800 bg-slate-900"
    : "border-slate-200 bg-white";

  const mutedClass = dark ? "text-slate-400" : "text-slate-500";

  const inputClass = `w-full rounded-xl border px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
    dark
      ? "border-slate-700 bg-slate-800 text-white"
      : "border-slate-200 bg-white text-slate-900"
  }`;

  return (
    <div className={pageClass}>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Premium header with car image background */}
        <section className="relative isolate overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{
              backgroundImage: `url("${CAR_HEADER_IMAGE}")`,
            }}
            aria-hidden="true"
          />

          <div
            className={`absolute inset-0 -z-10 ${
              dark
                ? "bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/35"
                : "bg-gradient-to-r from-white/95 via-white/85 to-white/35"
            }`}
            aria-hidden="true"
          />

          <div className="flex min-h-[310px] flex-col justify-center p-6 sm:p-10">
            <div className="max-w-3xl">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black-600 text-2xl text-grey shadow-lg">
                  <svg
  xmlns="http://www.w3.org/2000/svg"
  width="28"
  height="28"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.8"
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-hidden="true"
>
  <path d="M5 17h14l1-5-2-5H6l-2 5 1 5Z" />
  <path d="M4 12h16M7 17v2m10-2v2M7 7l1-3h8l1 3" />
  <circle cx="7.5" cy="15" r="1" />
  <circle cx="16.5" cy="15" r="1" />
</svg>
                </div>

                <div>
                  <p className="text-lg font-extrabold tracking-tight">
                    Car Rental
                  </p>

                  <p
                    className={`text-xs font-semibold tracking-[0.18em] ${
                      dark ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    YOUR JOURNEY, YOUR WAY
                  </p>
                </div>
              </div>

              <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Find Your Perfect Ride.
              </h1>

              <p
                className={`mt-4 max-w-2xl text-base leading-7 sm:text-lg ${
                  dark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Discover the right car for every journey. Compare prices,
                explore vehicle categories, and find a ride that fits your
                plans.
              </p>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span>
                  Flexible rental dates
                </span>

                <span className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span>
                  Multiple vehicle categories
                </span>

                <span className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span>
                  Clear daily pricing
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Availability summary */}
        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${panelClass}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-sm font-medium ${mutedClass}`}>
                YOUR NEXT JOURNEY STARTS HERE
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                Available Cars
              </h2>

              <p className={`mt-1 text-sm ${mutedClass}`}>
                Choose your dates to find cars available for your trip.
              </p>
            </div>

            <div className="flex gap-3">
              <div
                className={`rounded-xl border px-4 py-3 ${
                  dark
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className={`text-xs ${mutedClass}`}>Car models</p>
                <p className="text-xl font-bold">{filteredCars.length}</p>
              </div>

              <div
                className={`rounded-xl border px-4 py-3 ${
                  dark
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className={`text-xs ${mutedClass}`}>Available units</p>
                <p className="text-xl font-bold">{totalAvailable}</p>
              </div>
            </div>
          </div>

          {/* Pickup and return dates */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="pickupDate"
                className="mb-2 block text-sm font-semibold"
              >
                Pickup date
              </label>

              <input
                id="pickupDate"
                type="date"
                min={getToday()}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="returnDate"
                className="mb-2 block text-sm font-semibold"
              >
                Return date
              </label>

              <input
                id="returnDate"
                type="date"
                min={startDate || getToday()}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex items-end">
              <div
                className={`w-full rounded-xl border px-4 py-3 ${
                  dark
                    ? "border-slate-700 bg-slate-800"
                    : "border-blue-100 bg-blue-50"
                }`}
              >
                <p className={`text-xs ${mutedClass}`}>
                  Selected duration
                </p>

                <p className="mt-1 font-bold">
                  {validDates
                    ? `${dateDuration} day(s)`
                    : "Select valid dates"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Filters and sorting */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Explore our fleet</h2>

              <p className={`mt-1 text-sm ${mutedClass}`}>
                Find a car that matches your needs and budget.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowFilters((previous) => !previous)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                <span>☷</span>
                {showFilters ? "Hide Filters" : "Add Filters"}

                {activeFilters.length > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700">
                    {activeFilters.length}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                <label htmlFor="sortCars" className={`text-sm ${mutedClass}`}>
                  Sort:
                </label>

                <select
                  id="sortCars"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortOption)
                  }
                  className={`${inputClass} min-w-[175px]`}
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Applied filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={filter.clear}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    dark
                      ? "border-blue-900 bg-blue-950 text-blue-200"
                      : "border-blue-200 bg-blue-50 text-blue-800"
                  }`}
                >
                  {filter.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}

              <button
                type="button"
                onClick={clearFilters}
                className="px-2 py-1.5 text-xs font-semibold text-blue-500 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Filter panel */}
          {showFilters && (
            <div
              className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${panelClass}`}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Filter your ride</h3>

                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    Choose your preferences, then apply filters.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-blue-500 hover:underline"
                >
                  Reset
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor="categoryFilter"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Category
                  </label>

                  <select
                    id="categoryFilter"
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="All">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="brandFilter"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Brand
                  </label>

                  <select
                    id="brandFilter"
                    value={brandFilter}
                    onChange={(event) => setBrandFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option value="All">All brands</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="modelFilter"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Model
                  </label>

                  <select
                    id="modelFilter"
                    value={modelFilter}
                    onChange={(event) => setModelFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option value="All">All models</option>
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="fuelFilter"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Fuel type
                  </label>

                  <select
                    id="fuelFilter"
                    value={fuelFilter}
                    onChange={(event) => setFuelFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option value="All">All fuel types</option>
                    {fuelTypes.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {fuel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="transmissionFilter"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Transmission
                  </label>

                  <select
                    id="transmissionFilter"
                    value={transmissionFilter}
                    onChange={(event) =>
                      setTransmissionFilter(event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="All">All transmissions</option>
                    {transmissions.map((transmission) => (
                      <option key={transmission} value={transmission}>
                        {transmission}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="maxPrice"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Maximum price per day (₹)
                  </label>

                  <input
                    id="maxPrice"
                    type="number"
                    min="0"
                    placeholder="Enter your budget"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`rounded-xl border px-5 py-2.5 text-sm font-semibold ${
                    dark
                      ? "border-slate-700 hover:bg-slate-800"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Clear Filters
                </button>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Invalid date message */}
        {!validDates && (
          <div
            className={`rounded-2xl border p-5 ${
              dark
                ? "border-amber-900 bg-amber-950/40 text-amber-200"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            Please choose a pickup date today or later and a return date after
            the pickup date.
          </div>
        )}

        {/* Loading state */}
        {loading && validDates && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

            <p className={`mt-4 text-sm ${mutedClass}`}>
              Finding cars available for your dates...
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && validDates && (
          <div
            className={`rounded-2xl border p-5 ${
              dark
                ? "border-red-900 bg-red-950/40 text-red-200"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && validDates && filteredCars.length === 0 && (
          <div
            className={`rounded-2xl border p-10 text-center ${panelClass}`}
          >
            <div className="text-5xl">🚘</div>

            <h3 className="mt-4 text-xl font-bold">No cars found</h3>

            <p className={`mx-auto mt-2 max-w-md text-sm ${mutedClass}`}>
              No available cars match your selected dates and filters. Try
              changing your dates or clearing some filters.
            </p>

            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Cars grouped by category */}
        {!loading &&
          !error &&
          validDates &&
          groupedCars.map(([category, categoryCars]) => (
            <section key={category} className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold sm:text-2xl">
                    {category}
                  </h3>

                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    {categoryCars.length}{" "}
                    {categoryCars.length === 1 ? "model" : "models"} available
                    in this category
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    dark
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {categoryCars.length}{" "}
                  {categoryCars.length === 1 ? "car" : "cars"}
                </span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {categoryCars.map((car) => {
                  const quantity =
                    car.availableQuantity ?? car.quantity ?? 0;

                  return (
                    <article
                      key={car.id}
                      className={`group overflow-hidden rounded-2xl border shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${panelClass}`}
                    >
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={getCarImage(car)}
                          alt={`${car.brand} ${car.model}`}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = CAR_HEADER_IMAGE;
                          }}
                        />

                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm">
                          {car.category}
                        </span>

                        <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                          Available
                        </span>
                      </div>

                      <div className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-bold">
                              {car.brand} {car.model}
                            </h4>

                            <p className={`mt-1 text-sm ${mutedClass}`}>
                              {car.fuelType || "Fuel not specified"} ·{" "}
                              {car.transmission ||
                                "Transmission not specified"}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xl font-extrabold text-blue-600">
                              ₹
                              {Number(car.pricePerDay).toLocaleString("en-IN")}
                            </p>

                            <p className={`text-xs ${mutedClass}`}>
                              per day
                            </p>
                          </div>
                        </div>

                        <div
                          className={`flex flex-wrap gap-x-4 gap-y-2 border-y py-3 text-sm ${
                            dark
                              ? "border-slate-800 text-slate-300"
                              : "border-slate-100 text-slate-600"
                          }`}
                        >
                          <span>⛽ {car.fuelType || "Fuel N/A"}</span>

                          <span>
                            ⚙️ {car.transmission || "Transmission N/A"}
                          </span>

                          <span>
                            🚗 {quantity}{" "}
                            {quantity === 1 ? "unit" : "units"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-xs ${mutedClass}`}>
                            {formatDate(startDate)} – {formatDate(endDate)}
                          </p>

                          <Link
                            to={`/cars/${car.id}`}
                            state={{ startDate, endDate }}
                            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                          >
                            View Details
                            <span className="ml-2" aria-hidden="true">
                              →
                            </span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

        <footer
          className={`border-t py-5 text-center text-xs ${mutedClass} ${
            dark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          Choose your dates, explore the fleet, and find the right ride for
          your next journey.
        </footer>
      </div>
    </div>
  );
}

export default Cars;
