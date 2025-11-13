
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

    try {
      const secondaryApp = initializeApp(auth.app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        mobile
      );
      const uid = userCredential.user.uid;
      const node = type === "hotel" ? "hotels" : "resto";

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
      setEntry({ name: "", location: "", email: "", mobile: "", type: "hotel" });
      fetchEntries();
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
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <header className="bg-blue-600 shadow-md py-4 px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-3 sticky top-0 z-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 text-center sm:text-left">
          <Building2 className="w-7 h-7 text-white" /> Super Admin Panel
        </h1>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
          {loggedInUser && (
            <span className="text-white text-sm sm:text-base font-medium truncate max-w-[180px] sm:max-w-[250px] text-center sm:text-right">
              {loggedInUser}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md transition text-sm sm:text-base"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </header>

      {/* Dashboard Cards */}
      <section className="w-full bg-gradient-to-r from-blue-50 to-blue-100 py-6 sm:py-8 px-4 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Total Entries */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center">
            <div>
              <h3 className="text-base sm:text-lg font-semibold opacity-90">
                Total Entries
              </h3>
              <p className="text-3xl sm:text-4xl font-bold mt-2">{totalEntries}</p>
            </div>
            <div className="bg-white/25 p-3 sm:p-4 rounded-full">
              <Database className="w-8 sm:w-10 h-8 sm:h-10 text-white" />
            </div>
          </div>

          {/* Hotels */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center">
            <div>
              <h3 className="text-base sm:text-lg font-semibold opacity-90">
                Total Hotels
              </h3>
              <p className="text-3xl sm:text-4xl font-bold mt-2">{hotelCount}</p>
            </div>
            <div className="bg-white/25 p-3 sm:p-4 rounded-full">
              <Building2 className="w-8 sm:w-10 h-8 sm:h-10 text-white" />
            </div>
          </div>

          {/* Restaurants */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center">
            <div>
              <h3 className="text-base sm:text-lg font-semibold opacity-90">
                Total Bars / Restaurants
              </h3>
              <p className="text-3xl sm:text-4xl font-bold mt-2">{restoCount}</p>
            </div>
            <div className="bg-white/25 p-3 sm:p-4 rounded-full">
              <UtensilsCrossed className="w-8 sm:w-10 h-8 sm:h-10 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <main className="flex-1 py-6 sm:py-8 px-4 sm:px-8 w-full max-w-7xl mx-auto">
        {/* Add / Update Form */}
        <div ref={formRef} className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-8 border border-gray-100">
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

          <form
            onSubmit={editingKey ? updateEntry : addEntry}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* Inputs */}
            {[
              {
                label: "Name",
                icon: <Building2 className="w-4 h-4" />,
                key: "name",
                type: "text",
              },
              {
                label: "Location",
                icon: <MapPin className="w-4 h-4" />,
                key: "location",
                type: "text",
              },
              {
                label: "Email",
                icon: <Mail className="w-4 h-4" />,
                key: "email",
                type: "email",
                disabled: !!editingKey,
              },
              {
                label: "Password",
                icon: <Lock className="w-4 h-4" />,
                key: "mobile",
                type: "text",
              },
            ].map((f) => (
              <div key={f.key}>
                <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                  {f.icon} {f.label}
                </label>
                <input
                  type={f.type}
                  value={entry[f.key]}
                  disabled={f.disabled}
                  onChange={(e) => setEntry({ ...entry, [f.key]: e.target.value })}
                  className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                />
              </div>
            ))}

            {/* Type */}
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-1">
                <Filter className="w-4 h-4" /> Type
              </label>
              <select
                value={entry.type}
                onChange={(e) => setEntry({ ...entry, type: e.target.value })}
                className="border border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
              >
                <option value="hotel">Hotel</option>
                <option value="resto">Bar / Restaurant</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={`col-span-1 sm:col-span-2 lg:col-span-3 text-white py-3 rounded-xl font-semibold shadow-md transition text-sm sm:text-base ${
                editingKey
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {editingKey ? "Update Entry" : "Add Entry"}
            </button>
          </form>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-2">
                <Search className="w-4 h-4" /> Search
              </label>
              <input
                type="text"
                placeholder="Search by name, location, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-gray-700 font-medium mb-2">
                <Filter className="w-4 h-4" /> Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
              >
                <option value="all">All</option>
                <option value="hotel">Hotel</option>
                <option value="resto">Bar / Restaurant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 border border-gray-100 overflow-x-auto">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
            Registered Entries
          </h3>
          <div className="w-full overflow-x-auto">
            <table className="min-w-[850px] w-full text-center border-collapse">
              <thead className="bg-blue-600 text-white text-sm sm:text-base">
                <tr>
                  {[
                    "Name",
                    "Location",
                    "Email",
                    "Password",
                    "Type",
                    "QR Code",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="p-3 border">
                      {h}
                    </th>
                  ))}
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
                      <td className="p-3 border text-center">
                        <div className="flex justify-center items-center">
                          <QRCodeCanvas value={item.uid} size={50} level="H" />
                        </div>
                      </td>
                      <td className="p-3 border">
                        <div className="flex flex-wrap justify-center gap-2">
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
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-4 mt-6">
              <button
                onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
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

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-gray-500 border-t mt-10 px-4">
        © {new Date().getFullYear()} Hotel & Bar Management System | Super Admin Panel
      </footer>
    </div>
  );
}
