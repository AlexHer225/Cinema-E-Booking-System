import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type SortBy = "Relevance" | "Title (A–Z)" | "Rating (High→Low)";

type SearchFilters = {
  query: string;
  genre: string;
  mpaa: string;
  showDate: string;
  sortBy: SortBy;
};

type Movie = {
  id: string;
  title: string;
  poster?: string;
  rating?: string;
  genre?: string[];
  datesPlaying?: string[];
};

type RecommendationMovie = Movie & {
  reason?: string;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() || "http://127.0.0.1:8000";

export default function Navbar() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    genre: "Any",
    mpaa: "Any",
    showDate: "Any",
    sortBy: "Relevance",
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const navigate = useNavigate();

  const checkAuth = () => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("focus", checkAuth);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <div style={styles.left}>
          <Link to="/" style={styles.brand}>
            🎬 CineScope
          </Link>
        </div>

        <div style={styles.center}>
          <Link to="/" style={styles.navLink}>
            Home
          </Link>
          <Link to="/explore" style={styles.navLink}>
            Explore
          </Link>
          <Link to="/about" style={styles.navLink}>
            About
          </Link>
        </div>

        <div style={styles.right}>
          <SearchDropdown filters={filters} onChange={setFilters} />

          {!isLoggedIn ? (
            <>
              <Link to="/login" style={styles.navBtn}>
                Log In
              </Link>

              <Link to="/register" style={styles.navBtn}>
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <AIRecommendationsDropdown />

              <Link to="/favorites" style={styles.navBtn}>
                Favorites
              </Link>

              <Link to="/editprofile" style={styles.navBtn}>
                Edit Profile
              </Link>

              <button onClick={handleLogout} style={styles.navBtn}>
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function AIRecommendationsDropdown() {
  const [open, setOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const fetchRecommendations = async () => {
    try {
      setOpen(true);
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      if (!token) {
        throw new Error("You must be logged in to view recommendations.");
      }

      const res = await fetch(`${API_BASE}/users/me/recommendations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let message = "Failed to load AI recommendations.";

        try {
          const data = await res.json();
          message = data.detail || data.message || message;
        } catch {
          // ignore parse failure
        }

        throw new Error(message);
      }

      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load AI recommendations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button ref={btnRef} onClick={fetchRecommendations} style={styles.aiBtn}>
        AI Picks ✨
      </button>

      {open && (
        <div ref={panelRef} style={styles.aiDropdown}>
          <div style={styles.aiHeader}>
            <div>
              <div style={styles.aiTitle}>AI Movie Recommendations</div>
              <div style={styles.aiSubtitle}>
                Based on your saved favorites
              </div>
            </div>

            <button style={styles.closeMiniBtn} onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          {loading && <div style={styles.aiMessage}>Generating recommendations…</div>}

          {error && <div style={styles.aiError}>{error}</div>}

          {!loading && !error && recommendations.length === 0 && (
            <div style={styles.aiMessage}>
              No recommendations yet. Add movies to your Favorites first.
            </div>
          )}

          {!loading &&
            !error &&
            recommendations.map((movie) => (
              <Link
                key={movie.id}
                to={`/movies/${movie.id}`}
                style={styles.recommendationItem}
                onClick={() => setOpen(false)}
              >
                <img
                  src={movie.poster || "https://via.placeholder.com/52"}
                  alt={movie.title}
                  style={styles.recommendationPoster}
                />

                <div>
                  <div style={styles.recommendationTitle}>{movie.title}</div>

                  <div style={styles.recommendationMeta}>
                    {(movie.rating || "NR")} • {(movie.genre || []).slice(0, 2).join(", ")}
                  </div>

                  {movie.reason && (
                    <div style={styles.recommendationReason}>
                      {movie.reason}
                    </div>
                  )}
                </div>
              </Link>
            ))}

          <button style={styles.refreshAiBtn} onClick={fetchRecommendations}>
            Refresh Recommendations
          </button>
        </div>
      )}
    </div>
  );
}

function SearchDropdown({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [moviesError, setMoviesError] = useState("");

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) for (const g of m.genre || []) set.add(g);
    return ["Any", ...Array.from(set).sort()];
  }, [movies]);

  const mpaaRatings = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) if (m.rating) set.add(m.rating);
    return ["Any", ...Array.from(set).sort()];
  }, [movies]);

  const showDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) for (const d of m.datesPlaying || []) set.add(d);
    return ["Any", ...Array.from(set).sort()];
  }, [movies]);

  const sorts: SortBy[] = ["Relevance", "Title (A–Z)", "Rating (High→Low)"];

  useEffect(() => {
    if (!open || movies.length > 0) return;

    setLoadingMovies(true);
    setMoviesError("");

    fetch(`${API_BASE}/movies`)
      .then((res) => res.json())
      .then((data: Movie[]) => setMovies(data))
      .catch((err) => setMoviesError(err.message))
      .finally(() => setLoadingMovies(false));
  }, [open, movies.length]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const filteredResults = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    let results = movies.filter((m) => {
      const titleOk = !q || m.title.toLowerCase().includes(q);
      const genreOk =
        filters.genre === "Any" || (m.genre || []).includes(filters.genre);
      const mpaaOk =
        filters.mpaa === "Any" || (m.rating || "") === filters.mpaa;
      const dateOk =
        filters.showDate === "Any" ||
        (m.datesPlaying || []).includes(filters.showDate);

      return titleOk && genreOk && mpaaOk && dateOk;
    });

    if (filters.sortBy === "Title (A–Z)") {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    } else if (filters.sortBy === "Rating (High→Low)") {
      results = [...results].sort((a, b) =>
        (b.rating || "").localeCompare(a.rating || "")
      );
    }

    return results.slice(0, 8);
  }, [movies, filters]);

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={styles.navBtn}
      >
        Search ▾
      </button>

      {open && (
        <div ref={panelRef} style={styles.dropdown}>
          <div style={styles.row}>
            <input
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder="Search movies..."
              style={styles.input}
            />
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div style={styles.row}>
              <label style={styles.label}>Genre</label>
              <select
                value={filters.genre}
                onChange={(e) => onChange({ ...filters, genre: e.target.value })}
                style={styles.select}
              >
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.row}>
              <label style={styles.label}>MPAA</label>
              <select
                value={filters.mpaa}
                onChange={(e) => onChange({ ...filters, mpaa: e.target.value })}
                style={styles.select}
              >
                {mpaaRatings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.row}>
            <label style={styles.label}>Show Date</label>
            <select
              value={filters.showDate}
              onChange={(e) =>
                onChange({ ...filters, showDate: e.target.value })
              }
              style={styles.select}
            >
              {showDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.row}>
            <label style={styles.label}>Sort by</label>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                onChange({ ...filters, sortBy: e.target.value as SortBy })
              }
              style={styles.select}
            >
              {sorts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 8 }}>
            {loadingMovies && (
              <div style={{ opacity: 0.85 }}>Loading movies…</div>
            )}

            {moviesError && (
              <div style={{ color: "#ffb4b4" }}>Error: {moviesError}</div>
            )}

            {!loadingMovies && !moviesError && filteredResults.length === 0 && (
              <div style={{ opacity: 0.85 }}>No matches.</div>
            )}

            {filteredResults.map((m) => (
              <Link
                key={m.id}
                to={`/movies/${m.id}`}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: 6,
                  alignItems: "center",
                  textDecoration: "none",
                  color: "white",
                }}
                onClick={() => setOpen(false)}
              >
                <img
                  src={m.poster || "https://via.placeholder.com/44"}
                  alt={m.title}
                  style={{
                    width: 44,
                    height: 44,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 800 }}>{m.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {(m.rating || "NR")} • {(m.genre || []).slice(0, 2).join(", ")}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button
              style={styles.clearBtn}
              onClick={() =>
                onChange({
                  query: "",
                  genre: "Any",
                  mpaa: "Any",
                  showDate: "Any",
                  sortBy: "Relevance",
                })
              }
            >
              Clear
            </button>
            <button style={styles.applyBtn} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    zIndex: 50,
    backdropFilter: "blur(10px)",
    background: "rgba(10, 10, 12, 0.4)",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  },
  inner: {
    height: "100%",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "0 24px",
  },
  left: {
    display: "flex",
    justifyContent: "flex-start",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    gap: 30,
  },
  right: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  brand: {
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 18,
    color: "white",
  },
  navLink: {
    textDecoration: "none",
    color: "rgba(255,255,255,0.85)",
    fontWeight: 600,
  },
  navBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  },
  aiBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "linear-gradient(135deg, rgba(120,90,255,0.45), rgba(255,255,255,0.08))",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: 46,
    width: 300,
    padding: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,0.9)",
    display: "grid",
    gap: 8,
    zIndex: 60,
  },
  aiDropdown: {
    position: "absolute",
    right: 0,
    top: 46,
    width: 390,
    maxHeight: 520,
    overflowY: "auto",
    padding: 14,
    borderRadius: 16,
    background: "rgba(8,8,12,0.96)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    color: "white",
    zIndex: 70,
  },
  aiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: 900,
  },
  aiSubtitle: {
    fontSize: 12,
    opacity: 0.72,
    marginTop: 2,
  },
  closeMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: "20px",
  },
  aiMessage: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    opacity: 0.9,
    fontSize: 14,
  },
  aiError: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,80,80,0.12)",
    color: "#ffb4b4",
    fontSize: 14,
  },
  recommendationItem: {
    display: "flex",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    textDecoration: "none",
    color: "white",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.055)",
    marginBottom: 10,
  },
  recommendationPoster: {
    width: 52,
    height: 72,
    objectFit: "cover",
    borderRadius: 8,
    flexShrink: 0,
  },
  recommendationTitle: {
    fontWeight: 900,
    marginBottom: 3,
  },
  recommendationMeta: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 6,
  },
  recommendationReason: {
    fontSize: 12,
    lineHeight: 1.35,
    opacity: 0.9,
  },
  refreshAiBtn: {
    width: "100%",
    padding: 9,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    marginTop: 4,
  },
  input: {
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "none",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "none",
    outline: "none",
  },
  row: {
    display: "grid",
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "white",
  },
  clearBtn: {
    flex: 1,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "white",
    padding: 8,
    borderRadius: 8,
    cursor: "pointer",
  },
  applyBtn: {
    flex: 1,
    background: "white",
    color: "black",
    padding: 8,
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
};