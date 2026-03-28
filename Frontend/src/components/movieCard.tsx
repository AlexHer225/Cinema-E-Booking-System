import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Movie } from "../types/Movie";

type Props = {
  movie: Movie;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() ||
  "http://localhost:8000";

export default function MovieCard({ movie }: Props) {
  const navigate = useNavigate();

  const movieId = (movie as any)._id ?? (movie as any).id;

  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (!movieId) {
      console.error("Movie ID is missing:", movie);
      return;
    }
    navigate(`/movies/${movieId}`);
  };

  useEffect(() => {
    if (!movieId) return;

    const checkFavorite = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/me/favorites`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const favorites: Movie[] = await res.json();

        const isSaved = favorites.some((m: any) => {
          const id = m._id ?? m.id;
          return id === movieId;
        });

        setIsFavorite(isSaved);
      } catch {
        // silent
      }
    };

    checkFavorite();
  }, [movieId]);


  const handleFavoriteClick = async (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation(); 

    if (!movieId) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Please log in to save favorites.");
      return;
    }

    try {
      setLoading(true);

      if (isFavorite) {
        const res = await fetch(`${API_BASE}/me/favorites/${movieId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error();
        setIsFavorite(false);
      } else {
        const res = await fetch(`${API_BASE}/me/favorites/${movieId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error();
        setIsFavorite(true);
      }
    } catch {
      alert("Failed to update favorites.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={styles.card}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      
      <div style={styles.favorite} onClick={handleFavoriteClick}>
        {isFavorite ? "⭐" : "☆"}
      </div>

      <img src={movie.poster} alt={movie.title} style={styles.poster} />

      <div style={styles.meta}>
        <h3 style={styles.title}>{movie.title}</h3>
        <p style={styles.sub}>
          {movie.rating} • {movie.genre?.join(", ")}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    background: "rgba(0,0,0,0.72)",
    borderRadius: 12,
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  poster: {
    width: "100%",
    height: 240,
    objectFit: "cover",
    display: "block",
  },
  meta: {
    padding: 12,
  },
  title: {
    color: "white",
    margin: 0,
    fontSize: 16,
    lineHeight: "20px",
  },
  sub: {
    margin: "6px 0 0",
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
  },
  favorite: {
    position: "absolute",
    top: 10,
    right: 10,
    fontSize: 22,
    zIndex: 2,
    cursor: "pointer",
    background: "rgba(0,0,0,0.6)",
    borderRadius: "50%",
    padding: "4px 6px",
    transition: "transform 0.15s ease",
  },
};