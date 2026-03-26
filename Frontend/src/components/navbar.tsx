import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

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

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        {/* LEFT */}
        <div style={styles.left}>
          <Link to="/" style={styles.brand}>
            🎬 CineScope
          </Link>
        </div>

        {/* CENTER */}
        <div style={styles.center}>
          <Link to="/" style={styles.navLink}>Home</Link>
          <Link to="/explore" style={styles.navLink}>Explore</Link>
          <Link to="/about" style={styles.navLink}>About</Link>
        </div>

        {/* RIGHT */}
        <div style={styles.right}>
          <SearchDropdown filters={filters} onChange={setFilters} />

          <Link to="/login" style={styles.navBtn}>
            Log In
          </Link>

          <Link to="/register" style={styles.navBtn}>
            Sign Up
          </Link>
        </div>
      </div>
    </header>
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
    for (const m of movies) {
      for (const g of m.genre || []) set.add(g);
    }
    return ["Any", ...Array.from(set).sort()];
  }, [movies]);

  const mpaaRatings = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) {
      if (m.rating) set.add(m.rating);
    }
    return ["Any", ...Array.from(set).sort()];
  }, [movies]);

  const showDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) {
      for (const d of m.datesPlaying || []) set.add(d);
    }
    return ["Any", ...Array.from(set).sort()];
  }, [movies]);

  const sorts: SortBy[] = ["Relevance", "Title (A–Z)", "Rating (High→Low)"];

  useEffect(() => {
    if (!open || movies.length > 0) return;

    fetch(`${API_BASE}/movies`)
      .then((res) => res.json())
      .then(setMovies)
      .catch((err) => setMoviesError(err.message))
      .finally(() => setLoadingMovies(false));
  }, [open, movies.length]);

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
          <input
            value={filters.query}
            onChange={(e) =>
              onChange({ ...filters, query: e.target.value })
            }
            placeholder="Search movies..."
            style={styles.input}
          />
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

  left: { display: "flex", justifyContent: "flex-start" },

  center: { display: "flex", justifyContent: "center", gap: 30 },

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

  // 🔥 UNIFIED BUTTON STYLE (Search / Login / Signup)
  navBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  dropdown: {
    position: "absolute",
    right: 0,
    top: 46,
    width: 250,
    padding: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,0.9)",
  },

  input: {
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    border: "none",
  },
};