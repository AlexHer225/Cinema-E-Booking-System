import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() ||
  "http://localhost:8000";

type Movie = {
  _id?: string;
  id?: string;
  title: string;
  rating?: string;
  description?: string;
  poster?: string;
  trailer?: string;
  genre?: string[];
};

type Showtime = {
  _id?: string;
  id?: string;
  movie_id: string;
  showroom_id?: string;
  showroom_name?: string;
  date: string;
  start_time: string;
  end_time?: string;
  movie_title?: string;
};

type ApiState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; movie: Movie };

type ShowtimesState =
  | { status: "loading"; showtimes: Showtime[] }
  | { status: "error"; message: string; showtimes: Showtime[] }
  | { status: "success"; showtimes: Showtime[] };

function toYouTubeEmbed(url: string): string {
  try {
    if (url.includes("youtube.com/embed/")) return url;

    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const vid = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${vid}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const vid = u.searchParams.get("v");
      if (vid) return `https://www.youtube.com/embed/${vid}`;
    }
  } catch {}
  return url;
}

function formatTimeToDisplay(time24: string): string {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return time24;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr.padStart(2, "0")} ${period}`;
}

function formatDateToDisplay(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MovieDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [showtimesState, setShowtimesState] = useState<ShowtimesState>({
    status: "loading",
    showtimes: [],
  });
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const sortedShowtimes = useMemo(() => {
    return [...showtimesState.showtimes].sort((a, b) => {
      const aValue = `${a.date} ${a.start_time}`;
      const bValue = `${b.date} ${b.start_time}`;
      return aValue.localeCompare(bValue);
    });
  }, [showtimesState.showtimes]);

  useEffect(() => {
    if (!id) {
      setState({ status: "error", message: "Missing movie id in URL." });
      return;
    }

    let cancelled = false;

    async function load() {
      setState({ status: "loading" });

      try {
        const res = await fetch(`${API_BASE}/movies/${id}`);
        if (!res.ok) throw new Error(`Failed to load movie (${res.status})`);

        const movie: Movie = await res.json();
        if (!cancelled) setState({ status: "success", movie });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (!cancelled) setState({ status: "error", message: msg });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      setShowtimesState({
        status: "error",
        message: "Missing movie id in URL.",
        showtimes: [],
      });
      return;
    }

    let cancelled = false;

    async function loadShowtimes() {
      setShowtimesState({
        status: "loading",
        showtimes: [],
      });

      try {
        const res = await fetch(`${API_BASE}/movies/${id}/showtimes`);
        if (!res.ok) {
          throw new Error(`Failed to load showtimes (${res.status})`);
        }

        const data = await res.json();
        const showtimes = Array.isArray(data) ? data : [];

        if (!cancelled) {
          setShowtimesState({
            status: "success",
            showtimes,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (!cancelled) {
          setShowtimesState({
            status: "error",
            message: msg,
            showtimes: [],
          });
        }
      }
    }

    loadShowtimes();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

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
        const isSaved = favorites.some((movie: any) => {
          const movieId = movie._id ?? movie.id;
          return movieId === id;
        });

        setIsFavorite(isSaved);
      } catch {
        // leave silent for now
      }
    };

    checkFavorite();
  }, [id]);

  const handleFavoriteClick = async () => {
    if (!id) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Please log in to save favorite movies.");
      return;
    }

    try {
      setFavoriteLoading(true);

      if (isFavorite) {
        const res = await fetch(`${API_BASE}/me/favorites/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to remove favorite");
        setIsFavorite(false);
      } else {
        const res = await fetch(`${API_BASE}/me/favorites/${id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to save favorite");
        setIsFavorite(true);
      }
    } catch (err) {
      console.error(err);
      alert("Could not update favorites.");
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div style={styles.page}>
        <div style={styles.container}>Loading movie…</div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={{ color: "white" }}>Couldn’t load movie.</p>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>{state.message}</p>
          <Link to="/" style={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { movie } = state;
  const embedUrl = movie.trailer ? toYouTubeEmbed(movie.trailer) : "";

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <Link to="/" style={styles.backLink}>
          ← Back
        </Link>

        <div style={styles.grid}>
          <div>
            {movie.poster ? (
              <img src={movie.poster} alt={movie.title} style={styles.poster} />
            ) : (
              <div style={styles.posterPlaceholder}>No poster</div>
            )}
          </div>

          <div style={styles.details}>
            <h1 style={styles.title}>{movie.title}</h1>

            <div style={styles.metaRow}>
              {movie.rating && <span style={styles.pill}>{movie.rating}</span>}
              {movie.genre &&
                movie.genre.map((g) => (
                  <span key={g} style={styles.pill}>
                    {g}
                  </span>
                ))}
            </div>

            <div style={styles.actionRow}>
              <button
                onClick={handleFavoriteClick}
                disabled={favoriteLoading}
                style={{
                  ...styles.favoriteBtn,
                  background: isFavorite ? "white" : "rgba(255,255,255,0.08)",
                  color: isFavorite ? "black" : "white",
                  opacity: favoriteLoading ? 0.7 : 1,
                }}
              >
                {favoriteLoading
                  ? "Saving..."
                  : isFavorite
                  ? "★ Favorited"
                  : "☆ Add to Favorites"}
              </button>
            </div>

            {movie.description && (
              <p style={styles.description}>{movie.description}</p>
            )}

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Showtimes</h3>

              {showtimesState.status === "loading" ? (
                <p style={styles.sectionHint}>Loading showtimes...</p>
              ) : showtimesState.status === "error" ? (
                <p style={styles.sectionHint}>{showtimesState.message}</p>
              ) : sortedShowtimes.length === 0 ? (
                <p style={styles.sectionHint}>No showtimes available.</p>
              ) : (
                <div style={styles.showtimeList}>
                  {sortedShowtimes.map((showtime) => {
                    const buttonLabel = `${formatDateToDisplay(
                      showtime.date
                    )} • ${formatTimeToDisplay(showtime.start_time)}`;

                    return (
                      <button
                        key={`${showtime.id ?? showtime._id ?? ""}-${showtime.date}-${showtime.start_time}`}
                        style={styles.timeBtn}
                        onClick={() =>
                          navigate(
                            `/booking/${encodeURIComponent(
                              movie.title
                            )}?time=${encodeURIComponent(
                              showtime.start_time
                            )}&date=${encodeURIComponent(showtime.date)}`
                          )
                        }
                      >
                        {buttonLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Trailer</h3>

              {movie.trailer ? (
                <div style={styles.videoWrap}>
                  <iframe
                    title={`${movie.title} trailer`}
                    src={embedUrl}
                    style={styles.iframe}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <p style={styles.sectionHint}>No trailer available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "fixed",
    inset: 0,
    paddingTop: 90,
    overflowY: "auto",
    overflowX: "hidden",
    backgroundColor: "#0a0a0c",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(255,255,255,0.08), transparent 60%), rgba(10,10,12,1)",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 24px 40px",
  },
  backLink: {
    display: "inline-block",
    marginBottom: 14,
    textDecoration: "none",
    color: "rgba(255,255,255,0.85)",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "340px 1fr",
    gap: 26,
    alignItems: "start",
  },
  poster: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
  },
  posterPlaceholder: {
    width: "100%",
    height: 500,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
  },
  details: { color: "white" },
  title: {
    margin: "0 0 10px",
    fontSize: 34,
    letterSpacing: 0.5,
  },
  metaRow: {
    display: "flex",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  pill: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 800,
    color: "rgba(255,255,255,0.92)",
  },
  actionRow: {
    display: "flex",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  favoriteBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },
  description: {
    margin: "0 0 18px",
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.85)",
  },
  section: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.12)",
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 16,
    letterSpacing: 0.4,
  },
  showtimeList: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  timeBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  sectionHint: {
    marginTop: 8,
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    lineHeight: 1.4,
  },
  videoWrap: {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "black",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: 0,
  },
};