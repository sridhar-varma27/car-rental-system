
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function Navbar() {
  const navigate = useNavigate();

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("cars-theme") === "dark"
  );

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(localStorage.getItem("cars-theme") === "dark");
    };

    window.addEventListener("cars-theme-change", syncTheme);

    return () => {
      window.removeEventListener("cars-theme-change", syncTheme);
    };
  }, []);

  const toggleTheme = () => {
    const nextDarkMode = !isDarkMode;

    localStorage.setItem("cars-theme", nextDarkMode ? "dark" : "light");
    setIsDarkMode(nextDarkMode);
    window.dispatchEvent(new Event("cars-theme-change"));
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/cars" className="text-2xl font-bold">
          CarRental
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/cars" className="hover:text-blue-400">
            Cars
          </Link>

          {token && (
            <Link to="/my-bookings" className="hover:text-blue-400">
              My Bookings
            </Link>
          )}

          {user?.role === "ADMIN" && (
            <Link to="/admin" className="hover:text-blue-400">
              Admin
            </Link>
          )}

          {token ? (
            <>
              <span className="hidden text-sm text-slate-300 md:block">
                {user?.name}
              </span>

              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-500 px-4 py-2 hover:bg-red-600"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700"
            >
              Login
            </Link>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:bg-slate-700"
          >
            <span>{isDarkMode ? "☀️" : "🌙"}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
