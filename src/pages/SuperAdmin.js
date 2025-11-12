import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { ref, set, get, remove, update } from "firebase/database";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  Filter,
  LogOut,
  Building2,
  MapPin,
  Mail,
  Lock,
  UtensilsCrossed,
  Database,
} from "lucide-react";

export default function SuperAdmin() {
  const [entries, setEntries] = useState([]);
  const [entry, setEntry] = useState({
    name: "",
    location: "",
    email: "",
    mobile: "",
    type: "hotel",
  });
  const [editingKey, setEditingKey] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 5;

  const navigate = useNavigate();
  const formRef = useRef(null);

  const [hotelCount, setHotelCount] = useState(0);
  const [restoCount, setRestoCount] = useState(0);

  // Fetch all hotels/restos
  const fetchEntries = async () => {
    const hotelSnap = await get(ref(db, "hotels"));
    const restoSnap = await get(ref(db, "resto"));

    const hotelData = hotelSnap.exists()
      ? Object.entries(hotelSnap.val()).map(([key, val]) => ({ key, ...val }))
      : [];
    const restoData = restoSnap.exists()
      ? Object.entries(restoSnap.val()).map(([key, val]) => ({ key, ...val }))
      : [];

    const combined = [...hotelData, ...restoData].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    setEntries(combined);
    setHotelCount(hotelData.length);
    setRestoCount(restoData.length);
  };

  useEffect(() => {
    fetchEntries();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setLoggedInUser(user.email);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  // Add new entry
  const addEntry = async (e) => {
    e.preventDefault();
    const { name, location, email, mobile, type } = entry;
    if (!name || !location || !email || !mobile || !type) {
      alert("All fields are required!");
      return;
    }

    // try {
    //   const userCredential = await createUserWithEmailAndPassword(
    //     auth,
    //     email,
    //     mobile
    //   );

    //   const uid = userCredential.user.uid;
    //   const node = type === "hotel" ? "hotels" : "resto";

    //   await set(ref(db, `${node}/${uid}`), {
    //     name,
    //     location,
    //     email,
    //     mobile,
    //     type,
    //     role: "admin",
    //     createdAt: Date.now(),
    //     uid,
    //   });

    //   alert(`${type === "hotel" ? "Hotel" : "Restaurant"} added successfully!`);
    //   setEntry({
    //     name: "",
    //     location: "",
    //     email: "",
    //     mobile: "",
    //     type: "hotel",
    //   });
    //   fetchEntries();
    // } catch (error) {
    //   alert(error.message);
    // }

    try {
      // ✅ Initialize secondary Firebase app to avoid switching auth context

      // Create secondary app (unique name)
      const secondaryApp = initializeApp(auth.app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      // ✅ Create new admin user without affecting Super Admin session
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        mobile
      );

      const uid = userCredential.user.uid;
      const node = type === "hotel" ? "hotels" : "resto";

      // ✅ Save new admin data to Realtime Database
      await set(ref(db, `${node}/${uid}`), {
        name,
        location,
        email,
        mobile,
        type,
        role: "admin",
        createdAt: Date.now(),
        uid,
      });

      alert(`${type === "hotel" ? "Hotel" : "Restaurant"} added successfully!`);

      // ✅ Clear form fields
      setEntry({
        name: "",
        location: "",
        email: "",
        mobile: "",
        type: "hotel",
      });

      // ✅ Refresh list
      fetchEntries();

      // ✅ Clean up: sign out from secondary app to release memory
      await secondaryAuth.signOut();
    } catch (error) {
      alert(error.message);
    }
  };

  // Update entry
  const updateEntry = async (e) => {
    e.preventDefault();
    if (!editingKey) return;

    const node = entry.type === "hotel" ? "hotels" : "resto";
    await update(ref(db, `${node}/${editingKey}`), { ...entry });
    alert(`${entry.type} updated successfully!`);
    setEditingKey(null);
    setEntry({ name: "", location: "", email: "", mobile: "", type: "hotel" });
    fetchEntries();
  };

  const editEntry = (key, item) => {
    setEntry(item);
    setEditingKey(key);
    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const deleteEntry = async (key, type) => {
    const node = type === "hotel" ? "hotels" : "resto";
    if (window.confirm(`Delete this ${type}?`)) {
      await remove(ref(db, `${node}/${key}`));
      fetchEntries();
    }
  };

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const filteredEntries = entries.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      (item.name.toLowerCase().includes(term) ||
        item.location.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term)) &&
      (filterType === "all" || item.type === filterType)
    );
  });

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredEntries.slice(
    indexOfFirstEntry,
    indexOfLastEntry
  );
  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);

  const totalEntries = hotelCount + restoCount;

  return (
    <div className="font-poppins min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 shadow-md py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-7 h-7 text-white" /> Super Admin Panel
        </h1>

        <div className="flex items-center gap-3">
          {loggedInUser && (
            <span className="hidden sm:block bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-xl">
              {loggedInUser}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md transition"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </header>

      {/* ✅ Dashboard Cards Section */}
      <section className="w-full bg-gradient-to-r from-blue-50 to-blue-100 py-8 px-4 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Total Entries */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center w-full">
            <div>
              <h3 className="text-lg font-semibold opacity-90 tracking-wide">
                Total Entries
              </h3>
              <p className="text-4xl font-bold mt-2">{totalEntries}</p>
            </div>
            <div className="bg-white/25 p-4 rounded-full">
              <Database className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Total Hotels */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center w-full">
            <div>
              <h3 className="text-lg font-semibold opacity-90 tracking-wide">
                Total Hotels
              </h3>
              <p className="text-4xl font-bold mt-2">{hotelCount}</p>
            </div>
            <div className="bg-white/25 p-4 rounded-full">
              <Building2 className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Total Bars / Restaurants */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center w-full">
            <div>
              <h3 className="text-lg font-semibold opacity-90 tracking-wide">
                Total Bars / Restaurants
              </h3>
              <p className="text-4xl font-bold mt-2">{restoCount}</p>
            </div>
            <div className="bg-white/25 p-4 rounded-full">
              <UtensilsCrossed className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 py-8 px-4 sm:px-8 w-full max-w-7xl mx-auto">
        {/* Add / Update Form */}
        <div
          ref={formRef}
          className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-10 border border-gray-100"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-blue-700 mb-6 flex items-center gap-2">
            {editingKey ? (
              <>
                <Edit className="w-5 h-5 text-green-600" /> Update Entry
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5 text-blue-600" /> Add New Entry
              </>
            )}
          </h2>

          {/* ✅ existing form remains unchanged */}
          <form
            onSubmit={editingKey ? updateEntry : addEntry}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* Name */}
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                <Building2 className="w-4 h-4" /> Name
              </label>
              <input
                type="text"
                value={entry.name}
                onChange={(e) => setEntry({ ...entry, name: e.target.value })}
                className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                <MapPin className="w-4 h-4" /> Location
              </label>
              <input
                type="text"
                value={entry.location}
                onChange={(e) =>
                  setEntry({ ...entry, location: e.target.value })
                }
                className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                <Mail className="w-4 h-4" /> Email
              </label>
              <input
                type="email"
                value={entry.email}
                onChange={(e) => setEntry({ ...entry, email: e.target.value })}
                className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={!!editingKey}
              />
            </div>

            {/* Password */}
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                <Lock className="w-4 h-4" /> Password
              </label>
              <input
                type="text"
                value={entry.mobile}
                onChange={(e) => setEntry({ ...entry, mobile: e.target.value })}
                className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                <Filter className="w-4 h-4" /> Type
              </label>
              <select
                value={entry.type}
                onChange={(e) => setEntry({ ...entry, type: e.target.value })}
                className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="hotel">Hotel</option>
                <option value="resto">Bar / Restaurant</option>
              </select>
            </div>

            <button
              type="submit"
              className={`col-span-1 md:col-span-2 lg:col-span-3 text-white py-3 rounded-xl font-semibold shadow-md transition ${
                editingKey
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {editingKey ? "Update Entry" : "Add Entry"}
            </button>
          </form>
        </div>

        {/* ✅ Everything below (search, filter, table, pagination) stays same */}
        {/* Search & Filter */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-2">
                <Search className="w-4 h-4" /> Search
              </label>
              <input
                type="text"
                placeholder="Search by name, location, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-2">
                <Filter className="w-4 h-4" /> Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All</option>
                <option value="hotel">Hotel</option>
                <option value="resto">Bar / Restaurant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100 overflow-x-auto">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            Registered Entries
          </h3>
          <table className="w-full text-center border-collapse min-w-[850px]">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-3 border">Name</th>
                <th className="p-3 border">Location</th>
                <th className="p-3 border">Email</th>
                <th className="p-3 border">Password</th>
                <th className="p-3 border">Type</th>
                <th className="p-3 border">QR Code</th>
                <th className="p-3 border">Actions</th>
              </tr>
            </thead>

            <tbody>
              {currentEntries.length > 0 ? (
                currentEntries.map((item) => (
                  <tr
                    key={item.uid}
                    className="hover:bg-blue-50 border-b transition duration-150"
                  >
                    <td className="p-3 border">{item.name}</td>
                    <td className="p-3 border">{item.location}</td>
                    <td className="p-3 border">{item.email}</td>
                    <td className="p-3 border">{item.mobile}</td>
                    <td className="p-3 border capitalize">{item.type}</td>

                    <td className="p-3 border text-center align-middle">
                      <div className="flex justify-center items-center">
                        <QRCodeCanvas value={item.uid} size={60} level="H" />
                      </div>
                    </td>

                    <td className="p-3 border text-center align-middle">
                      <div className="inline-flex gap-2 justify-center">
                        <button
                          onClick={() => editEntry(item.key, item)}
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-sm transition"
                        >
                          <Edit className="w-4 h-4" /> Update
                        </button>
                        <button
                          onClick={() => deleteEntry(item.key, item.type)}
                          className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center text-gray-500 py-6 italic"
                  >
                    No entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6 flex-wrap">
              <button
                onClick={() =>
                  currentPage > 1 && setCurrentPage(currentPage - 1)
                }
                disabled={currentPage === 1}
                className={`px-5 py-2 rounded-lg text-sm font-medium border transition ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-blue-600 border-gray-300 hover:bg-blue-50"
                }`}
              >
                ← Previous
              </button>
              <span className="text-gray-700 font-semibold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  currentPage < totalPages && setCurrentPage(currentPage + 1)
                }
                disabled={currentPage === totalPages}
                className={`px-5 py-2 rounded-lg text-sm font-medium border transition ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-blue-600 border-gray-300 hover:bg-blue-50"
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 text-sm text-gray-500 border-t mt-10">
        © {new Date().getFullYear()} Hotel & Bar Management System | Super Admin
        Panel
      </footer>
    </div>
  );
}
