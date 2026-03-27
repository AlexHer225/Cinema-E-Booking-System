import React, { useEffect, useState } from "react";
import MovieCard from "../components/movieCard";
import type { Movie } from "../types/Movie";

export default function FavoritesPage() {
  const bgUrl = "/images/backgroundImage.jpg";
  const API_URL = import.meta.env.VITE_API_URL;

  const [favoriteMovies, setFavoriteMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("access_token");
        if (!token) {
          throw new Error("You must be logged in to view favorite movies.");
        }

        const res = await fetch(`${API_URL}/me/favorites`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error(`Favorites API error: ${res.status}`);

        const data: Movie[] = await res.json();
        setFavoriteMovies(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load favorite movies");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [API_URL]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          paddingTop: "80px",
          paddingLeft: 60,
          paddingRight: 60,
          overflowY: "auto",
        }}
      >
        <section style={styles.section}>
          <h1 style={styles.h1}>My Favorite Movies</h1>
          <p style={styles.subtext}>Movies you’ve saved to your account.</p>

          {loading && <p style={styles.msg}>Loading…</p>}
          {error && <p style={styles.err}>{error}</p>}

          {!loading && !error && favoriteMovies.length === 0 && (
            <div style={styles.emptyState}>
              <h2 style={styles.emptyTitle}>No favorites yet</h2>
              <p style={styles.emptyText}>
                Save movies from the movie detail page and they’ll appear here.
              </p>
            </div>
          )}

          {!loading && !error && favoriteMovies.length > 0 && (
            <div style={styles.grid}>
              {favoriteMovies.map((movie: any) => (
                <MovieCard key={movie._id ?? movie.id} movie={movie} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    maxWidth: 1400,
    margin: "0 auto",
    minWidth: 0,
    background: "rgba(0,0,0,0.35)",
    padding: 24,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  h1: {
    color: "white",
    margin: 0,
    fontSize: 32,
    textAlign: "center",
    width: "100%",
  },
  subtext: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 10,
    marginBottom: 0,
    textAlign: "center",
    fontSize: 15,
  },
  msg: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 18,
    textAlign: "center",
  },
  err: {
    color: "#ffb3b3",
    marginTop: 18,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
    gap: 18,
    marginTop: 24,
  },
  emptyState: {
    marginTop: 28,
    padding: "30px 20px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    color: "white",
    fontSize: 24,
  },
  emptyText: {
    marginTop: 10,
    marginBottom: 0,
    color: "rgba(255,255,255,0.78)",
    fontSize: 15,
    lineHeight: 1.5,
  },
};