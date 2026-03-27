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
import ResetPassword from "./Pages/ResetPassword";
import AdminPortalPage from "./Pages/AdminPortal";
import FavoritesPage from "./Pages/FavoritePage";

function App() {
  return (
    <div style={styles.appWrapper}>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<MoviePage />} />
        <Route path="/movies/:id" element={<MovieDetail />} />
        <Route path="/video/:id" element={<VideoRedirect />} />
        <Route path="/booking/:title" element={<BookingPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/editprofile" element={<EditProfilePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin" element={<AdminPortalPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function VideoRedirect() {
  const url = window.location.pathname;
  const id = url.split("/").pop();
  return <Navigate to={`/movies/${id}`} replace />;
}

const styles: Record<string, React.CSSProperties> = {
  appWrapper: {
    minHeight: "100vh",
    width: "100vw",
  },
};

export default App;