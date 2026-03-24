import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/navbar";
import MoviePage from "./components/moviePage";
import MovieDetail from "./Pages/MovieDetail";
import HomePage from "./Pages/HomePage";
import BookingPage from "./Pages/BookingPage";
import LoginPage from "./Pages/LoginPage";
import RegisterPage from "./Pages/RegistrationPage";
import EditProfilePage from "./Pages/EditProfile";
import ResetPasswordPage from "./Pages/ResetPassword";
import AdminPortalPage from "./Pages/AdminPortal";

function App() {
  return (
    <div style={styles.appWrapper}>
      <Navbar />

      <Routes>
        {/* Home */}
        <Route path="/" element={<HomePage />} />

        {/* Explore */}
        <Route path="/explore" element={<MoviePage />} />

        {/* Movie Detail (new canonical route) */}
        <Route path="/movies/:id" element={<MovieDetail />} />

        {/* Old route - redirect to canonical route */}
        <Route path="/video/:id" element={<VideoRedirect />} />

        {/* Booking */}
        <Route path="/booking/:title" element={<BookingPage />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/editprofile" element={<EditProfilePage />} />

        {/* 404 fallback (must be last) */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/ResetPassword" element={<ResetPasswordPage />} />
        <Route path="/admin" element={<AdminPortalPage />} />
      </Routes>
    </div>
  );
}

function VideoRedirect() {
  const url = window.location.pathname; // e.g. "/video/abc123"
  const id = url.split("/").pop();      // "abc123"
  return <Navigate to={`/movies/${id}`} replace />;
}

const styles: Record<string, React.CSSProperties> = {
  appWrapper: {
    minHeight: "100vh",
    width: "100vw",
  },
};

export default App;