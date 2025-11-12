import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import SuperAdmin from "./pages/SuperAdmin";
import Admin from "./pages/Admin";
import CustomerRegistration from "./pages/CustomerRegistration";
import RestoAdmin from "./pages/RestoAdmin";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="/admin" element={<Admin />} />
        <Route
          path="/customer-registration/:type/:hotelId"
          element={<CustomerRegistration />}
        />
        <Route path="/resto-admin" element={<RestoAdmin />} />
      </Routes>
    </Router>
  );
}
