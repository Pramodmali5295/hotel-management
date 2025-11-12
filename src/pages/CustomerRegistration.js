import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { ref, push, get, onValue } from "firebase/database";
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Home,
  Save,
  AlertTriangle,
} from "lucide-react";

export default function CustomerRegistration({
  hotelId: propHotelId,
  isOffline,
  onCustomerRegistered,
}) {
  const { hotelId: routeHotelId } = useParams();
  const hotelId = propHotelId || routeHotelId;
  const [hotelDetails, setHotelDetails] = useState(null);

  useEffect(() => {
    if (hotelId) {
      const hotelRef = ref(db, `hotels/${hotelId}`);
      onValue(hotelRef, (snapshot) => {
        if (snapshot.exists()) setHotelDetails(snapshot.val());
      });
    }
  }, [hotelId]);

  const isQRMode = !!(routeHotelId && !propHotelId);

  const [customer, setCustomer] = useState({
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

  const [roomsData, setRoomsData] = useState([]);
  const [bookedRooms, setBookedRooms] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [totalRooms, setTotalRooms] = useState([]);

  useEffect(() => {
    if (!hotelId) return;

    const hotelRef = ref(db, `hotels/${hotelId}`);
    get(hotelRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const roomCount = data.rooms || 0;

        if (roomCount > 0) {
          const roomsArray = Array.from({ length: roomCount }, (_, i) =>
            (101 + i).toString()
          );
          setTotalRooms(roomsArray);
        } else {
          setTotalRooms([]);
        }
      } else {
        setTotalRooms([]);
      }
    });
  }, [hotelId]);

  function toDateTime(dateStr, timeStr, isEnd = false) {
    if (!dateStr) return null;
    const time = timeStr ? timeStr : isEnd ? "23:59:59" : "00:00:00";
    const timeWithSeconds = time.length === 5 ? `${time}:00` : time;
    const iso = `${dateStr}T${timeWithSeconds}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  useEffect(() => {
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);
    setCustomer((prev) => ({
      ...prev,
      checkIn: currentDate,
      checkInTime: currentTime,
    }));
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    const custRef = ref(db, `hotels/${hotelId}/customers`);

    const computeBookedRooms = (data) => {
      const bookingList = Object.keys(data).map((k) => ({
        id: k,
        roomNo: data[k].roomNo,
        checkIn: data[k].checkIn,
        checkInTime: data[k].checkInTime,
        checkOut: data[k].checkOut,
        checkOutTime: data[k].checkOutTime,
      }));
      setRoomsData(bookingList);

      const now = new Date();
      const booked = bookingList
        .filter((b) => {
          const start = toDateTime(b.checkIn, b.checkInTime, false);
          const end = toDateTime(b.checkOut, b.checkOutTime, true);
          if (start && end) return now >= start && now <= end;
          if (!start && end) return now <= end;
          if (start && !end) return now >= start;
          return true;
        })
        .map((b) => String(b.roomNo));

      setBookedRooms(booked);
    };

    const unsubscribe = onValue(custRef, (snapshot) => {
      if (snapshot.exists()) computeBookedRooms(snapshot.val());
      else {
        setRoomsData([]);
        setBookedRooms([]);
      }
    });

    const interval = setInterval(() => {
      setRoomsData((prevData) => {
        if (prevData.length === 0) return prevData;
        const dataObj = {};
        prevData.forEach((b) => {
          dataObj[b.id] = b;
        });
        computeBookedRooms(dataObj);
        return prevData;
      });
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [hotelId]);

  const validateForm = () => {
    const errors = {};

    if (!customer.name?.trim()) errors.name = "Name is required.";
    if (!customer.mobile?.trim()) errors.mobile = "Mobile number is required.";
    else if (!/^[6-9]\d{9}$/.test(customer.mobile))
      errors.mobile = "Enter a valid 10-digit mobile number.";
    if (!customer.gender) errors.gender = "Select gender.";
    if (!customer.dob) errors.dob = "Select date of birth.";

    if (!isQRMode) {
      if (!customer.address?.trim()) errors.address = "Address is required.";
      if (!customer.roomNo?.toString().trim())
        errors.roomNo = "Room number is required.";
      if (!customer.checkIn) errors.checkIn = "Select check-in date.";
      if (!customer.checkInTime) errors.checkInTime = "Select check-in time.";
      if (!customer.checkOut) errors.checkOut = "Select check-out date.";
      if (!customer.checkOutTime)
        errors.checkOutTime = "Select check-out time.";
      if (
        customer.checkIn &&
        customer.checkOut &&
        new Date(`${customer.checkOut}T00:00:00`) <
          new Date(`${customer.checkIn}T00:00:00`)
      )
        errors.checkOut = "Check-out must be after check-in.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const calculateAge = (dob) => {
    if (!dob) return "";
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomer((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "dob") {
        updated.age = calculateAge(value);
      }
      return updated;
    });

    setValidationErrors((prev) => {
      const updated = { ...prev };
      if (name === "mobile") {
        if (/^[6-9]\d{0,9}$/.test(value)) delete updated.mobile;
      } else {
        delete updated[name];
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!hotelId) {
      alert("❌ Invalid hotel link. Please scan the correct QR code.");
      return;
    }

    if (!isQRMode && bookedRooms.includes(String(customer.roomNo))) {
      alert(
        "❌ This room is already booked for the selected period. Choose another room."
      );
      return;
    }

    const newCustRef = ref(db, `hotels/${hotelId}/customers`);
    const newCust = { ...customer, createdAt: Date.now(), messageSent: false };
    const pushed = await push(newCustRef, newCust);
    alert("✅ Customer registered successfully!");

    if (typeof onCustomerRegistered === "function") {
      onCustomerRegistered({ id: pushed.key, ...newCust });
    }

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);

    setCustomer({
      name: "",
      mobile: "",
      address: "",
      gender: "",
      dob: "",
      age: "",
      roomNo: "",
      checkIn: currentDate,
      checkInTime: currentTime,
      checkOut: "",
      checkOutTime: "",
    });
  };

  const handleRoomSelect = (num) => {
    setCustomer((prev) => ({ ...prev, roomNo: num }));
  };

  const isRoomBooked = (num) => bookedRooms.includes(String(num));

  return (
    <form
      className="bg-white/90 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl p-8 max-w-4xl mx-auto font-poppins"
      onSubmit={handleSubmit}
    >
      <h2 className="text-3xl font-bold text-center text-indigo-700 mb-6">
        {isQRMode ? "Customer Self Registration" : "Customer Registration"}
      </h2>

      {/* QR Mode Info */}
      {isQRMode && hotelId && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-200 rounded-2xl p-5 mb-6 shadow-sm text-center">
          <h2 className="text-2xl font-semibold text-indigo-700 mb-1">
            Welcome to {hotelDetails?.name || "Our Hotel"}
          </h2>
          <p className="text-gray-700">
            {hotelDetails?.location && (
              <span className="flex justify-center items-center gap-1">
                <MapPin className="w-4 h-4 text-indigo-600" />
                {hotelDetails.location}
              </span>
            )}
          </p>
          <div className="flex justify-center mt-2 text-sm text-gray-600 space-x-4">
            {hotelDetails?.email && <span>📧 {hotelDetails.email}</span>}
            {hotelDetails?.mobile && <span>📞 {hotelDetails.mobile}</span>}
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Name */}
        <div>
          <label className="text-gray-700 font-medium mb-1 flex items-center gap-1">
            <User className="w-4 h-4 text-indigo-500" /> Full Name
          </label>
          <input
            type="text"
            name="name"
            placeholder="Enter full name"
            value={customer.name}
            onChange={handleChange}
            className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
            required
          />
          {validationErrors.name && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
          )}
        </div>

        {/* Mobile */}
        <div>
          <label className="text-gray-700 font-medium mb-1 flex items-center gap-1">
            <Phone className="w-4 h-4 text-indigo-500" /> Mobile Number
          </label>
          <input
            type="text"
            name="mobile"
            placeholder="Enter mobile number"
            value={customer.mobile}
            onChange={handleChange}
            className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
            required
          />
          {validationErrors.mobile && (
            <p className="text-red-500 text-sm mt-1">
              {validationErrors.mobile}
            </p>
          )}
        </div>

        {/* Address (only for admin mode) */}
        {!isQRMode && (
          <div className="sm:col-span-2">
            <label className="text-gray-700 font-medium mb-1 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-indigo-500" /> Address
            </label>
            <input
              type="text"
              name="address"
              placeholder="Enter address"
              value={customer.address}
              onChange={handleChange}
              className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
            />
            {validationErrors.address && (
              <p className="text-red-500 text-sm mt-1">
                {validationErrors.address}
              </p>
            )}
          </div>
        )}

        {/* Gender */}
        <div>
          <label className="text-gray-700 font-medium mb-1">Gender</label>
          <select
            name="gender"
            value={customer.gender}
            onChange={handleChange}
            className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
            required
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {validationErrors.gender && (
            <p className="text-red-500 text-sm mt-1">
              {validationErrors.gender}
            </p>
          )}
        </div>

        {/* DOB */}
        <div>
          <label className="text-gray-700 font-medium mb-1 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-indigo-500" /> Date of Birth
          </label>
          <input
            type="date"
            name="dob"
            value={customer.dob}
            onChange={handleChange}
            className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
            required
          />
          {validationErrors.dob && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.dob}</p>
          )}
        </div>

        {/* Age */}
        {!isQRMode && (
          <div>
            <label className="text-gray-700 font-medium mb-1">Age</label>
            <input
              type="text"
              name="age"
              value={customer.age}
              readOnly
              className="border px-4 py-2.5 rounded-xl bg-gray-100 w-full"
            />
          </div>
        )}
      </div>

      {/* Additional fields for Admin */}
      {!isQRMode && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
            <div>
              <label className="text-gray-700 font-medium mb-1">
                <Calendar className="inline-block w-4 h-4 text-indigo-500" />{" "}
                Check-in Date
              </label>
              <input
                type="date"
                name="checkIn"
                value={customer.checkIn}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
              />
            </div>

            <div>
              <label className="text-gray-700 font-medium mb-1">
                <Clock className="inline-block w-4 h-4 text-indigo-500" />{" "}
                Check-in Time
              </label>
              <input
                type="time"
                name="checkInTime"
                value={customer.checkInTime}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
              />
            </div>

            <div>
              <label className="text-gray-700 font-medium mb-1">
                <Calendar className="inline-block w-4 h-4 text-indigo-500" />{" "}
                Check-out Date
              </label>
              <input
                type="date"
                name="checkOut"
                value={customer.checkOut}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
              />
            </div>

            <div>
              <label className="text-gray-700 font-medium mb-1">
                <Clock className="inline-block w-4 h-4 text-indigo-500" />{" "}
                Check-out Time
              </label>
              <input
                type="time"
                name="checkOutTime"
                value={customer.checkOutTime}
                onChange={handleChange}
                className="border border-gray-300 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Room Selection */}
          <div className="mt-6">
            <label className="block text-gray-700 font-medium mb-2">
              <Home className="inline-block w-4 h-4 text-indigo-500" /> Select
              Room Number
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {totalRooms.map((num) => {
                const booked = isRoomBooked(num);
                const selected = customer.roomNo === num;
                return (
                  <button
                    type="button"
                    key={num}
                    onClick={() => !booked && handleRoomSelect(num)}
                    className={`p-2 text-sm rounded-lg font-semibold transition border ${
                      booked
                        ? "bg-red-100 text-red-600 border-red-300 cursor-not-allowed"
                        : selected
                        ? "bg-green-100 text-green-700 border-green-400"
                        : "bg-gray-50 hover:bg-indigo-100 text-gray-700 border-gray-300"
                    }`}
                    disabled={booked}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Submit */}
      <div className="text-center pt-6">
        <button
          type="submit"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md transition-transform transform hover:scale-105"
        >
          <Save className="w-5 h-5" /> Register
        </button>
      </div>

      {/* Validation Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Please fill all required fields correctly.
        </div>
      )}
    </form>
  );
}
