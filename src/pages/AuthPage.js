import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ref, get, set, child } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, UserPlus, LogIn, Loader2, Building2 } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dbRef = ref(db);
      const superSnap = await get(child(dbRef, "superAdmin"));

      if (isRegister) {
        if (!superSnap.exists()) {
          const userCred = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
          await set(ref(db, "superAdmin"), {
            email: userCred.user.email,
            uid: userCred.user.uid,
          });
          alert("Super Admin registered successfully!");
          setIsRegister(false);
          return;
        } else {
          alert("Super Admin already exists! Please login instead.");
          setIsRegister(false);
          return;
        }
      }

      const userCred = await signInWithEmailAndPassword(auth, email, password);

      if (superSnap.exists() && superSnap.val().email === userCred.user.email) {
        navigate("/superadmin");
        return;
      }

      const hotelSnap = await get(child(dbRef, "hotels"));
      if (hotelSnap.exists()) {
        const hotels = hotelSnap.val();
        for (const key in hotels) {
          if (hotels[key].email === userCred.user.email) {
            navigate("/admin");
            return;
          }
        }
      }

      const restoSnap = await get(child(dbRef, "resto"));
      if (restoSnap.exists()) {
        const restos = restoSnap.val();
        for (const key in restos) {
          if (restos[key].email === userCred.user.email) {
            navigate("/resto-admin");
            return;
          }
        }
      }

      alert(
        "Access denied! Not registered as Super Admin, Hotel Admin, or Resto Admin."
      );
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-blue-200 to-blue-400 font-poppins px-4 sm:px-6 lg:px-8">
      {/* Card */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md border border-white/40 shadow-2xl rounded-3xl p-6 sm:p-8 md:p-10 transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 text-center">
          <div className="bg-blue-600 text-white p-3 sm:p-4 rounded-full shadow-md mb-3 sm:mb-4">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-snug">
            {isRegister ? "Super Admin Register" : "Welcome Back"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            {isRegister
              ? "Create a Super Admin account"
              : "Login to your account"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5 sm:space-y-6">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-3 sm:top-3.5 text-gray-400 w-5 h-5" />
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full pl-12 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 shadow-sm text-sm sm:text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-3 sm:top-3.5 text-gray-400 w-5 h-5" />
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full pl-12 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 shadow-sm text-sm sm:text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-white flex justify-center items-center gap-2 transition-all duration-300 shadow-md text-sm sm:text-base ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
              </>
            ) : isRegister ? (
              <>
                <UserPlus className="w-5 h-5" /> Register
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> Login
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-5 sm:mt-6">
          <p className="text-gray-700 text-sm sm:text-base">
            {isRegister
              ? "Already have an account?"
              : "Don’t have a Super Admin account?"}{" "}
            <span
              onClick={() => setIsRegister(!isRegister)}
              className="text-blue-600 font-semibold cursor-pointer hover:underline"
            >
              {isRegister ? "Login" : "Register"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
