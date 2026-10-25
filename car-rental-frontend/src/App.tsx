
import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Cars from "./pages/Cars";
import CarDetails from "./pages/CarDetails";
import Booking from "./pages/Booking";
import PaymentPage from "./pages/Payment";
import Confirmation from "./pages/Confirmation";
import MyBookings from "./pages/MyBookings";
import AdminDashboard from "./pages/AdminDashboard";
import ManageCars from "./pages/ManageCars";
import ManageBookings from "./pages/ManageBookings";

import Layout from "./layouts/Layout";
import { useAuthStore } from "./store/authStore";

function App() {
  const loadUser = useAuthStore((state) => state.loadUser);
  const loading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-lg text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user ? <Navigate to="/cars" replace /> : <Login />
          }
        />

        <Route
          path="/register"
          element={
            user ? <Navigate to="/cars" replace /> : <Register />
          }
        />

        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/cars" replace />} />

          <Route path="/cars" element={<Cars />} />
          <Route path="/cars/:id" element={<CarDetails />} />

          <Route
            path="/cars/:id/book"
            element={user ? <Booking /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/payment/:bookingId"
            element={
              user ? <PaymentPage /> : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/confirmation/:bookingId"
            element={
              user ? <Confirmation /> : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/my-bookings"
            element={
              user ? <MyBookings /> : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/admin"
            element={
              user?.role === "ADMIN" ? (
                <AdminDashboard />
              ) : (
                <Navigate to="/cars" replace />
              )
            }
          />

          <Route
            path="/admin/cars"
            element={
              user?.role === "ADMIN" ? (
                <ManageCars />
              ) : (
                <Navigate to="/cars" replace />
              )
            }
          />

          <Route
            path="/admin/bookings"
            element={
              user?.role === "ADMIN" ? (
                <ManageBookings />
              ) : (
                <Navigate to="/cars" replace />
              )
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/cars" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
