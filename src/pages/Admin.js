import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import {
  ref,
  get,
  onValue,
  child,
  set,
  remove,
  update,
} from "firebase/database";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import CustomerRegistration from "./CustomerRegistration";
import {
  LogOut,
  User,
  Building2,
  MapPin,
  Mail,
  Phone,
  QrCode,
  Search,
  Filter,
  Eye,
  Pencil,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  MessageSquarePlus,
} from "lucide-react";

export default function Admin() {
  const [hotel, setHotel] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loggedInUser, setLoggedInUser] = useState("");
  const [activeSection, setActiveSection] = useState("addRooms");
  const [genderFilter, setGenderFilter] = useState("");
  //const [showFilter, setShowFilter] = useState(false);
  const [checkInFilter, setCheckInFilter] = useState("");
  // const [checkOutFilter, setCheckOutFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 5;
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomCount, setRoomCount] = useState(hotel?.rooms || 0);

  const [messages, setMessages] = useState({
    checkin:
      "Hi {name}, welcome to {hotelName}! Your room number is {roomNo}. Enjoy your stay! Check-in: {checkInTime}",
    checkout:
      "Hi {name}, your checkout time is in 10 minutes ({checkOutTime}). Please contact reception if needed.",
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewCustomer, setViewCustomer] = useState(null);

  const [editCustomer, setEditCustomer] = useState({
    id: "",
    name: "",
    mobile: "",
    address: "",
    gender: "",
    dob: "",
    age: "",
    roomNo: "",
    checkIn: "",
    checkInTime: "",
    checkOut: "",
    checkOutTime: "",
  });

  const newMessageRef = useRef(null);
  const navigate = useNavigate();
  const prevCustomerIdsRef = useRef(new Set());
  const dummyMessageShownRef = useRef(false);

  // ------------------- MESSAGE HANDLER FUNCTION -------------------
  const handleCustomerRegistered = (customer) => {
    if (customer.messageSent) return;

    // 🛑 Skip if checkout info is missing
    if (!customer.checkOut || !customer.checkOutTime) {
      console.log(
        "⏳ Skipping message send — waiting for admin to add checkout info."
      );
      return;
    }

    // ✅ Send check-in message immediately
    if (messages.checkin) sendMessage(customer, "checkin");

    // ✅ Determine checkout date/time
    const checkoutDateTime = new Date(
      `${customer.checkOut}T${customer.checkOutTime}`
    );
    const now = new Date();

    // ✅ Store timeout IDs to clear after checkout
    const customTimeouts = [];

    // Schedule custom messages only before checkout
    const customKeys = Object.keys(messages).filter((key) =>
      key.startsWith("custom_")
    );
    customKeys.forEach((key, index) => {
      const delay = (index + 1) * 60 * 1000;
      const scheduledTime = new Date(now.getTime() + delay);

      if (scheduledTime < checkoutDateTime) {
        const timeoutId = setTimeout(() => sendMessage(customer, key), delay);
        customTimeouts.push(timeoutId);
      }
    });

    // Schedule checkout message (1 min before checkout)
    if (messages.checkout) {
      const delay = checkoutDateTime.getTime() - now.getTime() - 1 * 60 * 1000;
      if (delay > 0) {
        setTimeout(() => {
          sendMessage(customer, "checkout");
          customTimeouts.forEach((id) => clearTimeout(id));
        }, delay);
      }
    }

    // ✅ Mark as message sent
    if (hotel?.id && customer?.id) {
      update(
        ref(db, `${hotel.nodeType}/${hotel.id}/customers/${customer.id}`),
        {
          messageSent: true,
        }
      );
    }
  };

  // ------------------- AUTH + HOTEL/RESTO DATA FETCH -------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoggedInUser(user.email);
        const dbRef = ref(db);
        const nodes = ["hotels", "resto"];
        let found = false;

        for (const node of nodes) {
          const snapshot = await get(child(dbRef, node));
          if (snapshot.exists()) {
            const items = snapshot.val();
            for (const key in items) {
              if (items[key].email === user.email) {
                setHotel({ id: key, nodeType: node, ...items[key] });

                if (node === "resto" && !dummyMessageShownRef.current) {
                  alert(
                    `Welcome ${items[key].name}! This is a demo message for your bar/restaurant admin panel.`
                  );
                  dummyMessageShownRef.current = true;
                }

                const msgRef = ref(db, `${node}/${key}/messages`);
                onValue(msgRef, (msgSnap) => {
                  if (msgSnap.exists()) setMessages(msgSnap.val());
                });

                found = true;
                break;
              }
            }
          }
          if (found) break;
        }

        if (!found) {
          alert("Admin not found in database!");
          navigate("/");
        }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // ------------------- CUSTOMERS FETCH -------------------
  // useEffect(() => {
  //   if (!hotel?.id) return;
  //   const customerRef = ref(db, `${hotel.nodeType}/${hotel.id}/customers`);

  //   const unsubscribe = onValue(customerRef, (snapshot) => {
  //     if (snapshot.exists()) {
  //       const data = snapshot.val();
  //       const customerList = Object.keys(data)
  //         .map((key) => ({ id: key, ...data[key] }))
  //         .sort((a, b) => b.createdAt - a.createdAt);

  //       customerList.forEach((cust) => {
  //         if (!cust.messageSent && !prevCustomerIdsRef.current.has(cust.id)) {
  //           prevCustomerIdsRef.current.add(cust.id);
  //           handleCustomerRegistered(cust);
  //         }
  //       });

  //       const now = new Date();
  //       customerList.forEach((cust) => {
  //         if (cust.checkOut && cust.checkOutTime) {
  //           const checkoutDateTime = new Date(
  //             `${cust.checkOut}T${cust.checkOutTime}`
  //           );
  //           if (now > checkoutDateTime) {
  //             update(
  //               ref(db, `${hotel.nodeType}/${hotel.id}/customers/${cust.id}`),
  //               { status: "checkedout" }
  //             );
  //           }
  //         }
  //       });

  //       setCustomers(customerList);
  //     } else {
  //       setCustomers([]);
  //     }
  //   });

  //   return () => unsubscribe();
  // }, [hotel]);
  useEffect(() => {
  if (!hotel?.id) return;
  const customerRef = ref(db, `${hotel.nodeType}/${hotel.id}/customers`);

  const unsubscribe = onValue(customerRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const customerList = Object.keys(data)
        .map((key) => ({ id: key, ...data[key] }))
        .sort((a, b) => b.createdAt - a.createdAt);

      customerList.forEach((cust) => {
        if (!cust.messageSent && !prevCustomerIdsRef.current.has(cust.id)) {
          prevCustomerIdsRef.current.add(cust.id);
          handleCustomerRegistered(cust);
        }
      });

      const now = new Date();
      customerList.forEach((cust) => {
        if (cust.checkOut && cust.checkOutTime) {
          const checkoutDateTime = new Date(
            `${cust.checkOut}T${cust.checkOutTime}`
          );
          if (now > checkoutDateTime) {
            update(
              ref(db, `${hotel.nodeType}/${hotel.id}/customers/${cust.id}`),
              { status: "checkedout" }
            );
          }
        }
      });

      setCustomers(customerList);
    } else {
      setCustomers([]);
    }
  });

  return () => unsubscribe();

  // ✅ Suppress the missing dependency warning safely
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [hotel]);


  // ------------------- MESSAGE MANAGEMENT -------------------
  const handleSaveMessages = async () => {
    if (!hotel?.id) return;
    await set(ref(db, `${hotel.nodeType}/${hotel.id}/messages`), messages);
    alert("✅ Message templates saved successfully!");
  };

  const handleAddMessage = () => {
    const newKey = `custom_${Date.now()}`;
    const updatedMessages = {
      ...messages,
      [newKey]: "Dear {name}, this is a custom message from {hotelName}.",
    };
    setMessages(updatedMessages);
    setTimeout(() => {
      if (newMessageRef.current) newMessageRef.current.focus();
    }, 100);
  };

  const handleDeleteMessage = async (key) => {
    if (!hotel?.id) return;
    const updatedMessages = { ...messages };
    delete updatedMessages[key];
    setMessages(updatedMessages);
    await set(
      ref(db, `${hotel.nodeType}/${hotel.id}/messages`),
      updatedMessages
    );
    alert("Message deleted successfully!");
  };

  const handleUpdateMessage = async (key, value) => {
    const updated = { ...messages, [key]: value };
    setMessages(updated);
    await update(ref(db, `${hotel.nodeType}/${hotel.id}/messages`), updated);
  };

  // ------------------- CUSTOMER MANAGEMENT -------------------
  const handleDeleteCustomer = async (id) => {
    if (!hotel?.id) return;
    await remove(ref(db, `${hotel.nodeType}/${hotel.id}/customers/${id}`));
    alert("Customer deleted successfully!");
  };

  const openEditModal = (cust) => {
    setEditCustomer({ ...cust });
    setEditModalOpen(true);
  };

  const openViewModal = (cust) => {
    setViewCustomer(cust);
    setViewModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!hotel?.id || !editCustomer.id) return;

    await update(
      ref(db, `${hotel.nodeType}/${hotel.id}/customers/${editCustomer.id}`),
      editCustomer
    );

    setEditModalOpen(false);
    alert("✅ Customer updated successfully!");

    // ✅ Trigger message sending only when checkout info is available
    if (editCustomer.checkOut && editCustomer.checkOutTime) {
      handleCustomerRegistered(editCustomer);
    } else {
      console.log("⏳ Waiting for checkout info to start message scheduling.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const filteredCustomers = customers.filter((cust) => {
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      cust.name?.toLowerCase().includes(term) || cust.mobile?.includes(term);

    const matchesCheckIn = !checkInFilter || cust.checkIn === checkInFilter;
    // const matchesCheckOut = !checkOutFilter || cust.checkOut === checkOutFilter;

    // ✅ Add gender filter check here (before return)
    const matchesGender =
      !genderFilter ||
      cust.gender?.toLowerCase() === genderFilter.toLowerCase();

    // ✅ Include matchesGender in return
    return matchesSearch && matchesCheckIn && matchesGender;
  });

  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = filteredCustomers.slice(
    indexOfFirstCustomer,
    indexOfLastCustomer
  );
  const totalPages = Math.ceil(filteredCustomers.length / customersPerPage);

  const handlePageChange = (page) => setCurrentPage(page);
  useEffect(() => {
    if (showRoomModal && hotel?.id && hotel.nodeType === "hotels") {
      const roomRef = ref(db, `hotels/${hotel.id}/rooms`);
      get(roomRef).then((snapshot) => {
        if (snapshot.exists()) {
          setRoomCount(snapshot.val());
        } else {
          setRoomCount("");
        }
      });
    }
  }, [showRoomModal, hotel]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, checkInFilter, genderFilter]);

  const sendMessage = (customer, type) => {
    const msgTemplate = messages[type];
    if (!msgTemplate) return;

    const msg = msgTemplate
      .replace("{name}", customer.name)
      .replace("{hotelName}", hotel.name)
      .replace("{roomNo}", customer.roomNo)
      .replace("{checkInTime}", customer.checkInTime)
      .replace("{checkOutTime}", customer.checkOutTime);

    console.log(`📩 Sending ${type} message to ${customer.mobile}: ${msg}`);
  };

  if (!hotel) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-indigo-100 to-blue-200">
        <h2 className="text-2xl text-indigo-700 font-semibold animate-pulse">
          Loading your dashboard...
        </h2>
      </div>
    );
  }

  // ------------------- UI -------------------

  return (
    <div className="font-poppins min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-indigo-100">
        {/* HEADER */}
        <div className="sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center mb-8 bg-gradient-to-r from-indigo-700 to-blue-600 text-white p-6 rounded-2xl shadow-lg backdrop-blur-md bg-opacity-95">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-white/90" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {hotel.name} Dashboard
              </h1>
              <p className="text-indigo-100/90 text-sm">
                Manage customers, registration & messages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <span className="hidden sm:flex items-center gap-2 bg-white/15 px-4 py-1.5 rounded-lg text-sm">
              <Mail className="w-4 h-4" /> {loggedInUser}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500/90 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>

        {/* HOTEL INFO + QR */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white shadow p-6 rounded-2xl border border-gray-200 hover:shadow-lg transition">
            <h2 className="text-lg font-semibold text-indigo-700 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Hotel Information
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-gray-800">
              <p className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">Name:</span> {hotel.name}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">Location:</span>{" "}
                {hotel.location}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">Email:</span> {hotel.email}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">Mobile:</span> {hotel.mobile}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-blue-100 p-6 rounded-2xl text-center shadow border border-indigo-100">
            <h2 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center gap-2 justify-center">
              <QrCode className="w-5 h-5" /> Customer Registration QR
            </h2>
            <div className="flex justify-center">
              <QRCodeCanvas
                value={
                  hotel
                    ? `${window.location.origin}/customer-registration/${hotel.nodeType}/${hotel.id}`
                    : ""
                }
                size={120}
                bgColor="#fff"
                fgColor="#4674f4ff"
                className="p-2 bg-white rounded-lg shadow"
              />
            </div>
            <div className="text-center mt-3 break-all text-sm text-gray-600">
              {hotel
                ? `${window.location.origin}/customer-registration/${hotel.nodeType}/${hotel.id}`
                : ""}
            </div>
          </div>
        </div>

        {/* NAV BUTTONS */}

        <div className="flex flex-wrap justify-center sm:justify-start gap-4 mb-8 bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-md border border-gray-200">
          {[
            { id: "addRooms", label: "Add Rooms", icon: Building2 },
            { id: "registration", label: "Add Customer", icon: User },
            { id: "customers", label: "Customer List", icon: Search },
            {
              id: "messages",
              label: "Custom Message",
              icon: MessageSquarePlus,
            },
          ].map((btn) => {
            const Icon = btn.icon;

            const handleClick =
              btn.id === "addRooms"
                ? () => setShowRoomModal(true)
                : () => setActiveSection(btn.id);

            return (
              <button
                key={btn.id}
                onClick={handleClick}
                className={`flex items-center justify-center gap-2 flex-1 min-w-[150px] sm:min-w-[180px] px-5 py-3 rounded-xl font-semibold text-sm sm:text-base shadow-sm transition-all duration-200 
          ${
            activeSection === btn.id
              ? "bg-indigo-600 text-white scale-[1.03] shadow-lg"
              : "bg-white border border-gray-300 text-indigo-700 hover:bg-indigo-50 hover:scale-[1.03]"
          }`}
              >
                <Icon className="w-5 h-5" />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* REGISTRATION SECTION */}
        {activeSection === "registration" && (
          <CustomerRegistration
            hotelId={hotel.id}
            isOffline
            onCustomerRegistered={handleCustomerRegistered}
          />
        )}

        {/* CUSTOMER LIST SECTION */}
        {activeSection === "customers" && (
          <div className="bg-white shadow-2xl rounded-3xl border border-gray-200 p-6 sm:p-8 transition-all duration-300">
            {/* Header */}
            {/* <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-indigo-700 tracking-wide flex items-center gap-2">
                <User className="w-6 h-6" /> Customer List
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="date"
                    value={checkInFilter}
                    onChange={(e) => setCheckInFilter(e.target.value)}
                    className="w-full outline-none text-sm sm:text-base bg-transparent"
                  />
                  {checkInFilter && (
                    <button
                      type="button"
                      onClick={() => setCheckInFilter("")}
                      className="ml-2 text-gray-500 hover:text-red-500 text-lg font-semibold"
                      title="Clear date filter"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="relative w-full">
                  <Filter
                    className="absolute left-3 top-3 text-gray-400"
                    size={18}
                  />
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="border border-gray-300 pl-10 pr-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  >
                    <option value="">All Genders</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>

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
            </div> */}
            <div className="flex flex-col mb-6">
              {/* 🧾 Heading */}
              <h2 className="text-2xl font-bold text-indigo-700 tracking-wide flex items-center gap-2 mb-4">
                <User className="w-6 h-6" /> Customer List
              </h2>

              {/* 🔍 Filters Below Heading */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 📅 Check-In Date Filter */}
                <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="date"
                    value={checkInFilter}
                    onChange={(e) => setCheckInFilter(e.target.value)}
                    className="w-full outline-none text-sm sm:text-base bg-transparent"
                  />
                  {checkInFilter && (
                    <button
                      type="button"
                      onClick={() => setCheckInFilter("")}
                      className="ml-2 text-gray-500 hover:text-red-500 text-lg font-semibold"
                      title="Clear date filter"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* ⚧ Gender Filter */}

                <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <Filter className="text-gray-400 mr-2" size={18} />
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="w-full outline-none text-sm sm:text-base bg-transparent"
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
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-md">
              <table className="min-w-full text-sm text-gray-700">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                    <th className="p-3 text-left font-semibold">Room No</th>
                    <th className="p-3 text-left font-semibold">Name</th>
                    <th className="p-3 text-left font-semibold">Mobile</th>
                    <th className="p-3 text-left font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Check-In Time
                      </span>
                    </th>
                    <th className="p-3 text-left font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Check-Out Time
                      </span>
                    </th>
                    <th className="p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length > 0 ? (
                    currentCustomers.map((cust, index) => (
                      <tr
                        key={cust.id}
                        className={`${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        } hover:bg-indigo-50 transition-all`}
                      >
                        <td className="p-3">{cust.roomNo}</td>
                        <td className="p-3 font-medium text-gray-800">
                          {cust.name}
                        </td>
                        <td className="p-3">{cust.mobile}</td>
                        <td className="p-3">{cust.checkInTime}</td>
                        <td className="p-3">{cust.checkOutTime}</td>
                        <td className="p-3 text-center">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openViewModal(cust)}
                              className="inline-flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm shadow-sm transition-all"
                            >
                              <Eye className="w-4 h-4" /> View
                            </button>

                            <button
                              onClick={() => openEditModal(cust)}
                              className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-sm shadow-sm transition-all"
                            >
                              <Pencil className="w-4 h-4" /> Update
                            </button>

                            <button
                              onClick={() => handleDeleteCustomer(cust.id)}
                              className="inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm shadow-sm transition-all"
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
                        colSpan="6"
                        className="text-center py-6 text-gray-500 font-medium"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                {/* Previous Button */}
                <button
                  onClick={() =>
                    currentPage > 1 && handlePageChange(currentPage - 1)
                  }
                  disabled={currentPage === 1}
                  className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-medium border transition inline-flex items-center gap-2 ${
                    currentPage === 1
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-indigo-600 border-gray-300 hover:bg-indigo-50"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                {/* Page Indicator */}
                <span className="text-gray-700 font-semibold">
                  Page {currentPage} of {totalPages}
                </span>

                {/* Next Button */}
                <button
                  onClick={() =>
                    currentPage < totalPages &&
                    handlePageChange(currentPage + 1)
                  }
                  disabled={currentPage === totalPages}
                  className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-medium border transition inline-flex items-center gap-2 ${
                    currentPage === totalPages
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-indigo-600 border-gray-300 hover:bg-indigo-50"
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- MESSAGE GENERATOR SECTION ---------------- */}
        {activeSection === "messages" && (
          <div className="bg-white p-6 sm:p-7 rounded-2xl shadow-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-indigo-700 mb-5 flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5" />
              Add messages
            </h2>

            {Object.keys(messages).map((key) => (
              <div key={key} className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={messages[key]}
                  onChange={(e) => handleUpdateMessage(key, e.target.value)}
                  className="flex-1 border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  ref={key.startsWith("custom_") ? newMessageRef : null}
                />
                <button
                  onClick={() => handleDeleteMessage(key)}
                  className="inline-flex items-center gap-1 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            ))}

            <div className="flex flex-wrap gap-3 mt-3">
              <button
                onClick={handleAddMessage}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700"
              >
                <MessageSquarePlus className="w-4 h-4" /> Add Custom Message
              </button>
              <button
                onClick={handleSaveMessages}
                className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
              >
                <Save className="w-4 h-4" /> Save Messages
              </button>
            </div>
          </div>
        )}

        {/* VIEW MODAL */}
        {viewModalOpen && viewCustomer && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-auto p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-3xl relative shadow-2xl">
              <button
                onClick={() => setViewModalOpen(false)}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
                <Eye className="w-5 h-5" /> Customer Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-gray-700">Name</p>
                  <p className="text-gray-900">{viewCustomer.name}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Mobile</p>
                  <p className="text-gray-900">{viewCustomer.mobile}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Address</p>
                  <p className="text-gray-900">{viewCustomer.address}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Gender</p>
                  <p className="text-gray-900">{viewCustomer.gender}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">DOB</p>
                  <p className="text-gray-900">{viewCustomer.dob}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Age</p>
                  <p className="text-gray-900">{viewCustomer.age}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Room No</p>
                  <p className="text-gray-900">{viewCustomer.roomNo}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Check-In</p>
                  <p className="text-gray-900">{viewCustomer.checkIn}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Check-In Time</p>
                  <p className="text-gray-900">{viewCustomer.checkInTime}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Check-Out</p>
                  <p className="text-gray-900">{viewCustomer.checkOut}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Check-Out Time</p>
                  <p className="text-gray-900">{viewCustomer.checkOutTime}</p>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="inline-flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL */}

        {editModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-auto p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-3xl relative shadow-2xl">
              <button
                onClick={() => setEditModalOpen(false)}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
                <Pencil className="w-5 h-5" /> Edit Customer
              </h2>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={editCustomer.name}
                    onChange={(e) =>
                      setEditCustomer({ ...editCustomer, name: e.target.value })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Mobile
                  </label>
                  <input
                    type="text"
                    placeholder="Enter mobile number"
                    value={editCustomer.mobile}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        mobile: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Enter address"
                    value={editCustomer.address}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        address: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Gender
                  </label>
                  <select
                    value={editCustomer.gender}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        gender: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editCustomer.dob}
                    onChange={(e) =>
                      setEditCustomer({ ...editCustomer, dob: e.target.value })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="Enter age"
                    value={editCustomer.age}
                    onChange={(e) =>
                      setEditCustomer({ ...editCustomer, age: e.target.value })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Room No */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Room No
                  </label>
                  <input
                    type="text"
                    placeholder="Enter room number"
                    value={editCustomer.roomNo}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        roomNo: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Check-In Date */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Check-In Date
                  </label>
                  <input
                    type="date"
                    value={editCustomer.checkIn}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        checkIn: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Check-In Time */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Check-In Time
                  </label>
                  <input
                    type="time"
                    value={editCustomer.checkInTime}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        checkInTime: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Check-Out Date */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Check-Out Date
                  </label>
                  <input
                    type="date"
                    value={editCustomer.checkOut}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        checkOut: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Check-Out Time */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="time"
                    value={editCustomer.checkOutTime}
                    onChange={(e) =>
                      setEditCustomer({
                        ...editCustomer,
                        checkOutTime: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="inline-flex items-center gap-2 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* ✅ Add Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setShowRoomModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Add Number of Rooms
            </h2>

            <input
              type="number"
              min="1"
              placeholder="Enter number of rooms"
              value={roomCount}
              onChange={(e) => setRoomCount(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRoomModal(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!hotel?.id) return;
                  await update(ref(db, `${hotel.nodeType}/${hotel.id}`), {
                    rooms: Number(roomCount),
                  });
                  setShowRoomModal(false);
                  alert(`✅ Updated number of rooms to ${roomCount}`);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
