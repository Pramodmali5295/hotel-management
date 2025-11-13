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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 font-poppins flex flex-col">
      {!showQRMode && (
        <header className="bg-blue-600 shadow-md py-4 px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 sticky top-0 z-50">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 text-center sm:text-left">
            <QrCode className="w-6 h-6 text-white" /> Resto Admin
          </h1>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {loggedInUser && (
              <span className="bg-white/20 text-white font-medium px-3 py-1 rounded-lg text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[250px]">
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

      <main className="flex-1 max-w-6xl mx-auto py-8 px-4 sm:px-6">
        {/* --- RESTO INFO + QR + DASHBOARD (ADMIN MODE) --- */}

        {!showQRMode && restoInfo && (
          <>
            {/* Resto Info + QR Code in one row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="bg-white shadow p-6 rounded-2xl border border-gray-200">
                <h2 className="text-lg sm:text-xl font-semibold text-indigo-700 mb-4 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-600" /> Restaurant Info
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-800 text-sm sm:text-base">
                  <p className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold">Name:</span>{" "}
                    {restoInfo.name}
                  </p>

                  <p className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold">Email:</span>{" "}
                    {restoInfo.email}
                  </p>

                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold">Mobile:</span>{" "}
                    {restoInfo.mobile}
                  </p>

                  <p className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold">Total Customers:</span>{" "}
                    {customers.length}
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-blue-100 p-6 rounded-2xl text-center shadow border border-indigo-100">
                <h2 className="text-lg sm:text-xl font-semibold text-indigo-700 mb-3 flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-600" /> Registration QR
                </h2>

                <div className="flex justify-center">
                  <QRCodeCanvas
                    value={`${window.location.origin}/resto-admin?qrMode=true&restoId=${restoInfo.uid}`}
                    size={150}
                    className="p-2 bg-white rounded-lg shadow"
                  />
                </div>

                <div className="mt-3 break-all text-xs sm:text-sm text-gray-600">
                  {`${window.location.origin}/resto-admin?qrMode=true&restoId=${restoInfo.uid}`}
                </div>
              </div>
            </div>

            {/* Dashboard Cards */}
            <section className="py-4 px-3 sm:px-6 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Total Customers",
                    count: totalCustomers,
                    color: "from-blue-500 to-blue-600",
                    icon: <Users className="w-8 h-8 sm:w-10 sm:h-10" />,
                  },
                  {
                    title: "Recent Check-ins",
                    count: activeCheckins,
                    color: "from-green-500 to-emerald-600",
                    icon: <QrCode className="w-8 h-8 sm:w-10 sm:h-10" />,
                  },
                  {
                    title: "Active Messages",
                    count: totalMessages,
                    color: "from-amber-500 to-orange-600",
                    icon: <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10" />,
                  },
                ].map((card, i) => (
                  <div
                    key={i}
                    className={`bg-gradient-to-br ${card.color} text-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold opacity-90">
                          {card.title}
                        </h3>
                        <p className="text-3xl sm:text-4xl font-bold mt-2">
                          {card.count}
                        </p>
                      </div>

                      <div className="bg-white/25 p-3 sm:p-4 rounded-full">
                        {card.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* --- QR MODE RESTAURANT CARD (IMAGE STYLE) --- */}
        {showQRMode && restoInfo && (
          <div className="w-full mb-6">
            <div className="bg-gradient-to-br from-blue-50 via-white to-blue-100 p-5 rounded-2xl shadow-md">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
                  <h2 className="text-xl font-bold text-white">
                    Welcome to {restoInfo.name}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Please complete your registration
                  </p>
                </div>

                {/* Content - 2 Column Grid */}
                <div className="p-6 text-gray-700 text-base grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Restaurant Name */}
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">
                      Restaurant Name:
                    </span>
                    <span>{restoInfo.name}</span>
                  </div>

                  {/* Mobile */}
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">Mobile:</span>
                    <span>{restoInfo.mobile}</span>
                  </div>

                  {/* Location */}
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">
                      Location:
                    </span>
                    <span>{restoInfo.location || "Not provided"}</span>
                  </div>

                  {/* Email */}
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">Email:</span>
                    <span className="break-all">{restoInfo.email}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        {!showQRMode && (
          <div className="flex flex-wrap justify-center sm:justify-start gap-3 mb-6">
            {[
              { key: "add", label: "Add Customer", icon: <UserPlus /> },
              { key: "list", label: "Customer List", icon: <Users /> },
              { key: "messages", label: "Messages", icon: <MessageSquare /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
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
              <UserPlus /> {editingKey ? "Update Customer" : "Add New Customer"}
            </h2>

            <form
              onSubmit={editingKey ? updateCustomer : addCustomer}
              className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6"
            >
              {[
                { id: "name", label: "Full Name", type: "text" },
                { id: "mobile", label: "Mobile Number", type: "tel" },
                { id: "dob", label: "Date of Birth", type: "date" },
              ].map(({ id, label, type }) => (
                <div key={id} className="flex flex-col">
                  <label
                    htmlFor={id}
                    className="font-medium mb-1 text-gray-700 text-sm sm:text-base"
                  >
                    {label}
                  </label>
                  <input
                    id={id}
                    type={type}
                    value={customer[id]}
                    onChange={(e) =>
                      setCustomer({ ...customer, [id]: e.target.value })
                    }
                    className="border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}

              {/* Gender */}
              <div className="flex flex-col">
                <label
                  htmlFor="gender"
                  className="font-medium mb-1 text-gray-700 text-sm sm:text-base"
                >
                  Gender
                </label>
                <select
                  id="gender"
                  value={customer.gender}
                  onChange={(e) =>
                    setCustomer({ ...customer, gender: e.target.value })
                  }
                  className="border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Save /> {editingKey ? "Update" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Customer List */}
        {/* {activeSection === "list" && (
          <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 border border-gray-100 overflow-x-auto">
            <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-6 flex items-center gap-2">
              <Users /> Customer List
            </h2>

           
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
             
              <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm sm:text-base"
                />

                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate("")}
                    className="ml-2 text-gray-500 hover:text-red-500"
                    title="Clear date filter"
                  >
                    ×
                  </button>
                )}
              </div>

             
              <div className="relative">
                <Filter className="absolute left-3 top-3 text-gray-400" />
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

             
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or mobile..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 pl-10 pr-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                />
              </div>
            </div>

         

            <div className="w-full overflow-x-auto">
              <table className="min-w-full border-collapse text-xs sm:text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="p-2 sm:p-3 text-left border-b whitespace-nowrap">
                      Name
                    </th>
                    <th className="p-2 sm:p-3 text-left border-b whitespace-nowrap">
                      Mobile
                    </th>
                    <th className="p-2 sm:p-3 text-left border-b whitespace-nowrap">
                      DOB
                    </th>
                    <th className="p-2 sm:p-3 text-left border-b whitespace-nowrap">
                      Gender
                    </th>
                    <th className="p-2 sm:p-3 text-center border-b whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {currentCustomers.length > 0 ? (
                    currentCustomers.map(([key, item]) => (
                      <tr
                        key={key}
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                        <td className="p-2 sm:p-3 border-b align-middle max-w-[150px] truncate">
                          {item.name}
                        </td>

                        <td className="p-2 sm:p-3 border-b align-middle max-w-[120px] truncate">
                          {item.mobile}
                        </td>

                        <td className="p-2 sm:p-3 border-b align-middle max-w-[120px] truncate">
                          {item.dob}
                        </td>

                        <td className="p-2 sm:p-3 border-b align-middle max-w-[100px] truncate">
                          {item.gender}
                        </td>

                        <td className="p-2 sm:p-3 border-b text-center">
                          <div className="flex flex-row sm:flex-row justify-center items-center gap-2 flex-wrap">
                            <button
                              onClick={() => editCustomerHandler(key, item)}
                              className="flex items-center justify-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm"
                            >
                              <Edit3 size={14} /> Update
                            </button>

                            <button
                              onClick={() => deleteCustomer(key)}
                              className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm"
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
                        className="text-center py-4 text-gray-500 italic border-b"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center items-center gap-3 mt-6 text-sm sm:text-base">
                <button
                  onClick={() =>
                    currentPage > 1 && handlePageChange(currentPage - 1)
                  }
                  disabled={currentPage === 1}
                  className={`px-5 py-2 rounded-lg border ${
                    currentPage === 1
                      ? "bg-gray-100 text-gray-400"
                      : "bg-white text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  ← Prev
                </button>
                <span className="text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    currentPage < totalPages &&
                    handlePageChange(currentPage + 1)
                  }
                  disabled={currentPage === totalPages}
                  className={`px-5 py-2 rounded-lg border ${
                    currentPage === totalPages
                      ? "bg-gray-100 text-gray-400"
                      : "bg-white text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )} */}
        {activeSection === "list" && (
  <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 border border-gray-100">

    {/* Header */}
    <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-5 flex items-center gap-2">
      <Users /> Customer List
    </h2>

    {/* Filters */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* Date filter */}
      <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full bg-transparent outline-none text-sm sm:text-base"
        />
        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate("")}
            className="ml-2 text-gray-500 hover:text-red-500 font-bold text-lg"
          >
            ×
          </button>
        )}
      </div>

      {/* Gender filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-3 text-gray-400" />
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 pl-10 pr-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
        />
      </div>
    </div>

    {/* DESKTOP/TABLET TABLE VIEW */}
    <div className="hidden sm:block overflow-x-auto rounded-lg">
      <table className="min-w-full border-collapse text-xs sm:text-sm">
        <thead className="bg-blue-100">
          <tr>
            <th className="p-3 text-left border-b">Name</th>
            <th className="p-3 text-left border-b">Mobile</th>
            <th className="p-3 text-left border-b">DOB</th>
            <th className="p-3 text-left border-b">Gender</th>
            <th className="p-3 text-center border-b">Actions</th>
          </tr>
        </thead>

        <tbody>
          {currentCustomers.length > 0 ? (
            currentCustomers.map(([key, item]) => (
              <tr key={key} className="hover:bg-gray-50 transition-colors">
                <td className="p-3 border-b">{item.name}</td>
                <td className="p-3 border-b">{item.mobile}</td>
                <td className="p-3 border-b">{item.dob}</td>
                <td className="p-3 border-b">{item.gender}</td>

                <td className="p-3 border-b text-center">
                  <div className="flex justify-center gap-2">

                    <button
                      onClick={() => editCustomerHandler(key, item)}
                      className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm shadow-sm"
                    >
                      <Edit3 size={14} /> Update
                    </button>

                    <button
                      onClick={() => deleteCustomer(key)}
                      className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm shadow-sm"
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
                className="text-center py-4 text-gray-500 italic border-b"
              >
                No customers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* 📱 MOBILE CARD VIEW (sm:hidden) */}
    <div className="sm:hidden space-y-4">
      {currentCustomers.length > 0 ? (
        currentCustomers.map(([key, item]) => (
          <div
            key={key}
            className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50"
          >
            <div className="flex flex-col gap-2 text-sm">

              <p><span className="font-semibold">Name:</span> {item.name}</p>
              <p><span className="font-semibold">Mobile:</span> {item.mobile}</p>
              <p><span className="font-semibold">DOB:</span> {item.dob}</p>
              <p><span className="font-semibold">Gender:</span> {item.gender}</p>

            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 mt-3">

              <button
                onClick={() => editCustomerHandler(key, item)}
                className="flex items-center gap-1 w-full justify-center bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm shadow-sm"
              >
                <Edit3 size={16} /> Update
              </button>

              <button
                onClick={() => deleteCustomer(key)}
                className="flex items-center gap-1 w-full justify-center bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm shadow-sm"
              >
                <Trash2 size={16} /> Delete
              </button>

            </div>
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500 italic">No customers found.</p>
      )}
    </div>

    {/* Pagination */}
    {totalPages > 1 && (
      <div className="flex flex-wrap justify-center items-center gap-3 mt-6 text-sm sm:text-base">
        <button
          onClick={() =>
            currentPage > 1 && handlePageChange(currentPage - 1)
          }
          disabled={currentPage === 1}
          className={`px-5 py-2 rounded-lg border ${
            currentPage === 1
              ? "bg-gray-100 text-gray-400"
              : "bg-white text-blue-600 hover:bg-blue-50"
          }`}
        >
          ← Prev
        </button>

        <span className="text-gray-700">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() =>
            currentPage < totalPages && handlePageChange(currentPage + 1)
          }
          disabled={currentPage === totalPages}
          className={`px-5 py-2 rounded-lg border ${
            currentPage === totalPages
              ? "bg-gray-100 text-gray-400"
              : "bg-white text-blue-600 hover:bg-blue-50"
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
              <MessageSquare /> Manage Custom Messages
            </h2>

            <div className="flex flex-col gap-5">
              {Object.entries(messages).map(([key, msg]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-end gap-3"
                >
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      {key === "checkin"
                        ? "Check-in Message"
                        : key === "checkout"
                        ? "Checkout Message"
                        : `Custom Message (${key.replace("custom_", "#")})`}
                    </label>
                    <textarea
                      ref={key.startsWith("custom_") ? newMessageRef : null}
                      value={msg}
                      onChange={(e) => handleUpdateMessage(key, e.target.value)}
                      className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base resize-none"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteMessage(key)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 text-xs sm:text-sm"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={handleAddMessage}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm sm:text-base"
              >
                <MessageSquarePlus /> Add Custom Message
              </button>
              <button
                onClick={handleSaveMessages}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm sm:text-base"
              >
                <Save /> Save All
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
