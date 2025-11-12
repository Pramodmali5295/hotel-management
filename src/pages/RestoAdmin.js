import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { ref, get, set, update, remove } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  LogOut,
  UserPlus,
  Users,
  MessageSquare,
  QrCode,
  Search,
  Filter,
  Trash2,
  Edit3,
  Save,
  Phone,
  MessageSquarePlus,
} from "lucide-react";

export default function RestoAdmin() {
  const [restoInfo, setRestoInfo] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState({
    name: "",
    mobile: "",
    dob: "",
    gender: "",
  });
  const [editingKey, setEditingKey] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loggedInRestoId, setLoggedInRestoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");

  const customersPerPage = 5;

  const [messages, setMessages] = useState({
    checkin: "Hi {name}, welcome to {restoName}!",
    checkout: "Hi {name}, your checkout is in 10 minutes.",
  });
  const [activeSection, setActiveSection] = useState("info");
  const [showQRMode, setShowQRMode] = useState(false);
  const newMessageRef = useRef(null);
  const navigate = useNavigate();

  // -------------------- FETCH DATA --------------------
  const fetchCustomers = async (restoId) => {
    const restoSnap = await get(ref(db, `resto/${restoId}`));
    if (restoSnap.exists()) {
      setRestoInfo(restoSnap.val());

      const customerSnap = await get(ref(db, `resto/${restoId}/customers`));
      if (customerSnap.exists()) {
        const data = Object.entries(customerSnap.val());
        const sortedData = data.sort(
          (a, b) => (b[1]?.createdAt || 0) - (a[1]?.createdAt || 0)
        );
        setCustomers(sortedData);
      } else {
        setCustomers([]);
      }

      const msgSnap = await get(ref(db, `resto/${restoId}/messages`));
      if (msgSnap.exists()) setMessages(msgSnap.val());
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrMode = params.get("qrMode") === "true";
    const restoIdFromURL = params.get("restoId");

    if (qrMode && restoIdFromURL) {
      setShowQRMode(true);
      setLoggedInRestoId(restoIdFromURL);
      fetchCustomers(restoIdFromURL);
    } else {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setLoggedInUser(user.email);
          const restoSnap = await get(ref(db, "resto"));
          if (restoSnap.exists()) {
            const restos = restoSnap.val();
            for (const key in restos) {
              if (restos[key].email === user.email) {
                setLoggedInRestoId(key);
                fetchCustomers(key);
                break;
              }
            }
          }
        } else {
          navigate("/");
        }
      });
      return () => unsubscribe();
    }
  }, [navigate]);

  const sendMessage = (mobile, msg) => {
    console.log(`Sending message to ${mobile}: ${msg}`);
  };

  // -------------------- CUSTOMER MANAGEMENT --------------------

  const addCustomer = async (e) => {
    e.preventDefault();
    const { name, mobile, dob, gender } = customer;
    if (!name || !mobile || !dob || !gender) {
      alert("All fields are required!");
      return;
    }

    const restoId = showQRMode
      ? new URLSearchParams(window.location.search).get("restoId")
      : loggedInRestoId;

    if (!restoId) {
      alert("Error: Resto ID not found!");
      return;
    }

    try {
      const uid = Date.now().toString();

      // ✅ Add check-in date in readable format (YYYY-MM-DD)
      const now = new Date();
      const checkInDate = now.toISOString().split("T")[0];

      await set(ref(db, `resto/${restoId}/customers/${uid}`), {
        ...customer,
        createdAt: Date.now(),
        checkInDate, // ✅ Added field
        uid,
      });

      alert("Customer added successfully!");
      setCustomer({ name: "", mobile: "", dob: "", gender: "" });
      fetchCustomers(restoId);

      const restoName = restoInfo?.name || "our restaurant";

      // 📨 Send check-in message
      sendMessage(
        mobile,
        messages.checkin
          ?.replace("{name}", name)
          ?.replace("{restoName}", restoName)
      );

      let isCheckedOut = false;

      // 🕒 Auto checkout message after 3 minutes (for testing/demo)
      setTimeout(() => {
        sendMessage(
          mobile,
          messages.checkout
            ?.replace("{name}", name)
            ?.replace("{restoName}", restoName)
        );
        isCheckedOut = true;
      }, 3 * 60 * 1000);

      // 🧩 Send custom messages if configured
      const customMessages = Object.entries(messages)
        .filter(([key]) => key.startsWith("custom_"))
        .sort(([a], [b]) => a.localeCompare(b));

      customMessages.forEach(([key, msg], index) => {
        setTimeout(() => {
          if (!isCheckedOut) {
            sendMessage(
              mobile,
              msg?.replace("{name}", name)?.replace("{restoName}", restoName)
            );
          }
        }, (index + 1) * 60 * 1000);
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const updateCustomer = async (e) => {
    e.preventDefault();
    if (!editingKey) return;
    await update(ref(db, `resto/${loggedInRestoId}/customers/${editingKey}`), {
      ...customer,
    });
    alert("Customer updated successfully!");
    setCustomer({ name: "", mobile: "", dob: "", gender: "" });
    setEditingKey(null);
    fetchCustomers(loggedInRestoId);
  };

  const deleteCustomer = async (key) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      await remove(ref(db, `resto/${loggedInRestoId}/customers/${key}`));
      fetchCustomers(loggedInRestoId);
    }
  };

  const editCustomerHandler = (key, item) => {
    setCustomer(item);
    setEditingKey(key);
    setActiveSection("add");
  };

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // -------------------- FILTERING --------------------
  
  const filteredCustomers = customers.filter(([key, item]) => {
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      item.name.toLowerCase().includes(term) ||
      item.mobile.toLowerCase().includes(term) ||
      item.gender.toLowerCase().includes(term);

    const matchesFilter =
      filterValue === "" ||
      item.gender.toLowerCase() === filterValue.toLowerCase();

    // ✅ Add check-in date filter logic
    const matchesDate =
      selectedDate === "" || item.checkInDate === selectedDate;

    // ✅ Final condition
    return matchesSearch && matchesFilter && matchesDate;
  });

  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = filteredCustomers.slice(
    indexOfFirstCustomer,
    indexOfLastCustomer
  );
  const totalPages = Math.ceil(filteredCustomers.length / customersPerPage);
  const handlePageChange = (page) => setCurrentPage(page);

  // -------------------- MESSAGES --------------------
  const handleAddMessage = () => {
    const newKey = `custom_${Date.now()}`;
    setMessages({
      ...messages,
      [newKey]: "Hello {name}, this is a custom message!",
    });
    setTimeout(() => newMessageRef.current?.focus(), 100);
  };

  const handleDeleteMessage = async (key) => {
    const updated = { ...messages };
    delete updated[key];
    setMessages(updated);
    if (loggedInRestoId)
      await set(ref(db, `resto/${loggedInRestoId}/messages`), updated);
  };

  const handleUpdateMessage = async (key, value) => {
    const updated = { ...messages, [key]: value };
    setMessages(updated);
    if (loggedInRestoId)
      await update(ref(db, `resto/${loggedInRestoId}/messages`), updated);
  };

  const handleSaveMessages = async () => {
    if (loggedInRestoId) {
      await set(ref(db, `resto/${loggedInRestoId}/messages`), messages);
      alert("✅ Messages saved successfully!");
    }
  };
  // --- Dashboard Summary Stats ---
  const totalCustomers = customers.length;

  const activeCheckins = customers.filter(
    ([, c]) => Date.now() - c.createdAt < 24 * 60 * 60 * 1000 // last 24 hours
  ).length;

  const totalMessages = Object.keys(messages).length;

  // -------------------- UI --------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 font-poppins">
      {!showQRMode && (
        <header className="bg-blue-600 shadow-md py-4 px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 sticky top-0 z-50 backdrop-blur-md bg-blue-600/95">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <QrCode size={24} className="text-white" /> Resto Admin
          </h1>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {loggedInUser && (
              <span className="bg-white/20 text-white font-medium px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                {loggedInUser}
              </span>
            )}

            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-all shadow-sm"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </header>
      )}

      <main className="max-w-6xl mx-auto py-8 px-3 sm:px-6">
        {/* Restaurant Info */}

        {restoInfo && (
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            {/* 🟦 Restaurant Information Card */}
            <div className="bg-white shadow p-6 rounded-2xl border border-gray-200 hover:shadow-lg transition">
              <h2 className="text-lg font-semibold text-indigo-700 mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" /> Restaurant
                Information
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 text-gray-800">
                <p className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold">Name:</span>{" "}
                  {restoInfo.name || "—"}
                </p>
                <p className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold">Email:</span>{" "}
                  {restoInfo.email || "—"}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold">Mobile:</span>{" "}
                  {restoInfo.mobile || "—"}
                </p>
                <p className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold">Total Customers:</span>{" "}
                  {customers.length || 0}
                </p>
              </div>
            </div>

            {/* 🟩 QR Code Card */}
            {!showQRMode && (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-100 p-6 rounded-2xl text-center shadow border border-indigo-100 hover:shadow-lg transition">
                <h2 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center gap-2 justify-center">
                  <QrCode className="w-5 h-5 text-indigo-600" /> Customer
                  Registration QR
                </h2>

                <div className="flex justify-center">
                  <QRCodeCanvas
                    value={`${window.location.origin}/resto-admin?qrMode=true&restoId=${restoInfo.uid}`}
                    size={130}
                    bgColor="#fff"
                    fgColor="#4674f4ff"
                    className="p-2 bg-white rounded-lg shadow"
                  />
                </div>

                <div className="text-center mt-3 break-all text-sm text-gray-600">
                  {`${window.location.origin}/resto-admin?qrMode=true&restoId=${restoInfo.uid}`}
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Scan this QR to register customers directly.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Summary Section */}

        {!showQRMode && (
          <section className="w-full bg-gradient-to-r from-blue-50 to-blue-100 py-10 px-4 sm:px-8 mb-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Total Customers */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center w-full">
                <div>
                  <h3 className="text-lg font-semibold opacity-90 tracking-wide">
                    Total Customers
                  </h3>
                  <p className="text-4xl font-bold mt-2">{totalCustomers}</p>
                </div>
                <div className="bg-white/25 p-4 rounded-full">
                  <Users className="w-10 h-10 text-white" />
                </div>
              </div>

              {/* Active Check-ins */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center w-full">
                <div>
                  <h3 className="text-lg font-semibold opacity-90 tracking-wide">
                    Recent Check-ins
                  </h3>
                  <p className="text-4xl font-bold mt-2">{activeCheckins}</p>
                </div>
                <div className="bg-white/25 p-4 rounded-full">
                  <QrCode className="w-10 h-10 text-white" />
                </div>
              </div>

              {/* Active Messages */}
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex justify-between items-center w-full">
                <div>
                  <h3 className="text-lg font-semibold opacity-90 tracking-wide">
                    Active Messages
                  </h3>
                  <p className="text-4xl font-bold mt-2">{totalMessages}</p>
                </div>
                <div className="bg-white/25 p-4 rounded-full">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Navigation */}
        {!showQRMode && (
          <div className="flex flex-wrap gap-3 mb-6 justify-center sm:justify-start">
            {[
              {
                key: "add",
                label: "Add Customer",
                icon: <UserPlus size={18} />,
              },
              {
                key: "list",
                label: "Customer List",
                icon: <Users size={18} />,
              },
              {
                key: "messages",
                label: "Custom Messages",
                icon: <MessageSquare size={18} />,
              },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition text-sm sm:text-base ${
                  activeSection === key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-blue-50"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        )}

        {/* Add Customer Form */}
        {(showQRMode || activeSection === "add") && (
          <div className="bg-white shadow-lg rounded-2xl p-5 sm:p-8 border border-gray-100 mb-10">
            <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-6 flex items-center gap-2">
              <UserPlus size={20} />{" "}
              {editingKey ? "Update Customer" : "Add New Customer"}
            </h2>

            <form
              onSubmit={editingKey ? updateCustomer : addCustomer}
              className="grid md:grid-cols-2 gap-6 text-sm sm:text-base"
            >
              {/* Name */}
              <div className="flex flex-col">
                <label htmlFor="name" className="font-medium mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Enter full name"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                  className="border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Mobile */}
              <div className="flex flex-col">
                <label htmlFor="mobile" className="font-medium mb-1">
                  Mobile Number
                </label>
                <input
                  id="mobile"
                  type="tel"
                  placeholder="Enter mobile number"
                  value={customer.mobile}
                  onChange={(e) =>
                    setCustomer({ ...customer, mobile: e.target.value })
                  }
                  className="border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* DOB */}
              <div className="flex flex-col">
                <label htmlFor="dob" className="font-medium mb-1">
                  Date of Birth
                </label>
                <input
                  id="dob"
                  type="date"
                  value={customer.dob}
                  onChange={(e) =>
                    setCustomer({ ...customer, dob: e.target.value })
                  }
                  className="border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Gender */}
              <div className="flex flex-col">
                <label htmlFor="gender" className="font-medium mb-1">
                  Gender
                </label>
                <select
                  id="gender"
                  value={customer.gender}
                  onChange={(e) =>
                    setCustomer({ ...customer, gender: e.target.value })
                  }
                  className="border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Save size={18} /> {editingKey ? "Update" : "Add Customer"}
              </button>
            </form>
          </div>
        )}

        {/* Customer List */}
        {activeSection === "list" && (
          <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-6 flex items-center gap-2">
              <Users size={20} /> Customer List
            </h2>

            {/* Search + Filter */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* 📅 Check-In Date Filter */}
              <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full outline-none text-sm sm:text-base bg-transparent"
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate("")}
                    className="ml-2 text-gray-500 hover:text-red-500 text-lg font-semibold"
                    title="Clear date filter"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* ⚧ Gender Filter */}
              <div className="relative w-full">
                <Filter
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="border border-gray-300 pl-10 pr-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                >
                  <option value="">All Genders</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              {/* 🔍 Search Input */}
              <div className="relative w-full">
                <Search
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by name or mobile..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 pl-10 pr-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-blue-100 text-left">
                    <th className="p-2 sm:p-3 border-b whitespace-nowrap">
                      Name
                    </th>
                    <th className="p-2 sm:p-3 border-b whitespace-nowrap">
                      Mobile
                    </th>
                    <th className="p-2 sm:p-3 border-b whitespace-nowrap">
                      DOB
                    </th>
                    <th className="p-2 sm:p-3 border-b whitespace-nowrap">
                      Gender
                    </th>
                    <th className="p-2 sm:p-3 border-b text-center whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentCustomers.length > 0 ? (
                    currentCustomers.map(([key, item]) => (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="p-2 sm:p-3 border-b">{item.name}</td>
                        <td className="p-2 sm:p-3 border-b">{item.mobile}</td>
                        <td className="p-2 sm:p-3 border-b">{item.dob}</td>
                        <td className="p-2 sm:p-3 border-b">{item.gender}</td>
                        <td className="p-2 sm:p-3 border-b text-center">
                          <div className="flex flex-col sm:flex-row justify-center gap-2">
                            <button
                              onClick={() => editCustomerHandler(key, item)}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg flex items-center gap-1 text-xs sm:text-sm transition duration-150"
                            >
                              <Edit3 size={14} /> Update
                            </button>
                            <button
                              onClick={() => deleteCustomer(key)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg flex items-center gap-1 text-xs sm:text-sm transition duration-150"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="text-center py-4 text-gray-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6 flex-wrap text-sm sm:text-base">
                <button
                  onClick={() =>
                    currentPage > 1 && handlePageChange(currentPage - 1)
                  }
                  disabled={currentPage === 1}
                  className={`px-5 py-2 rounded-lg border transition ${
                    currentPage === 1
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-blue-600 border-gray-300 hover:bg-blue-50"
                  }`}
                >
                  ← Prev
                </button>
                <span className="text-gray-700 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    currentPage < totalPages &&
                    handlePageChange(currentPage + 1)
                  }
                  disabled={currentPage === totalPages}
                  className={`px-5 py-2 rounded-lg border transition ${
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
        )}

        {/* Messages */}
        {activeSection === "messages" && (
          <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-6 flex items-center gap-2">
              <MessageSquare size={20} /> Manage Custom Messages
            </h2>
            <div className="flex flex-col gap-4">
              {Object.entries(messages).map(([key, msg]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row gap-3 items-start"
                >
                  <div className="flex-1 w-full">
                    <label
                      htmlFor={`msg_${key}`}
                      className="text-sm font-medium text-gray-700 mb-1 block"
                    >
                      {key === "checkin"
                        ? "Check-in Message"
                        : key === "checkout"
                        ? "Checkout Message"
                        : `Custom Message (${key.replace("custom_", "#")})`}
                    </label>
                    <textarea
                      id={`msg_${key}`}
                      ref={key.startsWith("custom_") ? newMessageRef : null}
                      value={msg}
                      onChange={(e) => handleUpdateMessage(key, e.target.value)}
                      className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteMessage(key)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-xs sm:text-sm mt-2 sm:mt-7 self-end sm:self-start"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 justify-start">
              <button
                onClick={handleAddMessage}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 text-sm sm:text-base"
              >
                <MessageSquarePlus className="w-4 h-4" /> Add Custom Message
              </button>
              <button
                onClick={handleSaveMessages}
                className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm sm:text-base"
              >
                <Save className="w-4 h-4" /> Save All
              </button>
            </div>
          </div>
        )}
      </main>

      {!showQRMode && (
        <footer className="text-center py-4 text-xs sm:text-sm text-gray-500 border-t mt-10">
          © {new Date().getFullYear()} Resto Management | Admin Panel
        </footer>
      )}
    </div>
  );
}
