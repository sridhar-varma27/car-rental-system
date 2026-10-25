import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;