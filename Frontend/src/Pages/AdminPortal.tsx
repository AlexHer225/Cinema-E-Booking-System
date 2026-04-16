import React, { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  status: string;
  createdAt?: number;
  verifiedAt?: number;
};

type Movie = {
  id: string;
  title: string;
  description: string;
  trailer: string;
  poster: string;
  rating: string;
  genre: string[];
  currentlyPlaying: boolean;
  datesPlaying: string[];
  duration_minutes: number;
  cast: string[];
};

type Promotion = {
  id: string;
  movieTitle: string;
  discount: string;
};

type Showtime = {
  id: string;
  movie_id: string;
  showroom_id: string;
  showroom_name: string;
  date: string;
  start_time: string;
  end_time: string;
  movie_title?: string;
};

type Showroom = {
  id: string;
  name: string;
  total_seats: number;
  seat_layout: string[][];
};

type MovieForm = {
  title: string;
  description: string;
  trailer: string;
  poster: string;
  rating: string;
  genreInput: string;
  duration_minutes: string;
  castInput: string;
  currentlyPlaying: boolean;
};

type ShowtimeForm = {
  movie_id: string;
  showroom_id: string;
  date: string;
  start_time: string;
};

type UserForm = {
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
  status: string;
};

const bgUrl = "/images/backgroundImage.jpg";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminMoviesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showMovieModal, setShowMovieModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showShowtimeModal, setShowShowtimeModal] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [newUser, setNewUser] = useState<UserForm>({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "",
    status: "",
  });

  const [newMovie, setNewMovie] = useState<MovieForm>({
    title: "",
    description: "",
    trailer: "",
    poster: "",
    rating: "",
    genreInput: "",
    duration_minutes: "",
    castInput: "",
    currentlyPlaying: false,
  });

  const [newPromo, setNewPromo] = useState<Promotion>({
    id: "",
    movieTitle: "",
    discount: "",
  });

  const [newShowtime, setNewShowtime] = useState<ShowtimeForm>({
    movie_id: "",
    showroom_id: "",
    date: "",
    start_time: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [submittingMovie, setSubmittingMovie] = useState(false);
  const [submittingShowtime, setSubmittingShowtime] = useState(false);

  const [attemptedUserSubmit, setAttemptedUserSubmit] = useState(false);
  const [attemptedMovieSubmit, setAttemptedMovieSubmit] = useState(false);
  const [attemptedPromoSubmit, setAttemptedPromoSubmit] = useState(false);
  const [attemptedShowtimeSubmit, setAttemptedShowtimeSubmit] = useState(false);

  const token = localStorage.getItem("access_token");

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const userCountText = useMemo(() => {
    if (users.length === 1) return "1 user";
    return `${users.length} users`;
  }, [users]);

  const movieCountText = useMemo(() => {
    if (movies.length === 1) return "1 movie";
    return `${movies.length} movies`;
  }, [movies]);

  const promoCountText = useMemo(() => {
    if (promotions.length === 1) return "1 promotion";
    return `${promotions.length} promotions`;
  }, [promotions]);

  const showtimeCountText = useMemo(() => {
    if (showtimes.length === 1) return "1 showtime";
    return `${showtimes.length} showtimes`;
  }, [showtimes]);

  const movieTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    movies.forEach((movie) => {
      map[movie.id] = movie.title;
    });
    return map;
  }, [movies]);

  const showroomNameById = useMemo(() => {
    const map: Record<string, string> = {};
    showrooms.forEach((showroom) => {
      map[showroom.id] = showroom.name;
    });
    return map;
  }, [showrooms]);

  const normalizeUser = (rawUser: any): User => {
    const derivedRole =
      rawUser.role ||
      (String(rawUser.username || "").toLowerCase() === "admin" ? "Admin" : "Customer");

    return {
      id: String(rawUser.id || rawUser._id || ""),
      name: rawUser.name || "",
      email: rawUser.email || "",
      username: rawUser.username || "",
      role: derivedRole,
      status: rawUser.status || "Active",
      createdAt: rawUser.createdAt,
      verifiedAt: rawUser.verifiedAt,
    };
  };

  const resetUserForm = () => {
    setNewUser({
      name: "",
      email: "",
      username: "",
      password: "",
      role: "",
      status: "",
    });
    setEditingUserId(null);
    setAttemptedUserSubmit(false);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    resetUserForm();
  };

  const closeMovieModal = () => {
    setShowMovieModal(false);
    setAttemptedMovieSubmit(false);
    setNewMovie({
      title: "",
      description: "",
      trailer: "",
      poster: "",
      rating: "",
      genreInput: "",
      duration_minutes: "",
      castInput: "",
      currentlyPlaying: false,
    });
  };

  const closePromoModal = () => {
    setShowPromoModal(false);
    setAttemptedPromoSubmit(false);
    setNewPromo({
      id: "",
      movieTitle: "",
      discount: "",
    });
  };

  const closeShowtimeModal = () => {
    setShowShowtimeModal(false);
    setAttemptedShowtimeSubmit(false);
    setNewShowtime({
      movie_id: "",
      showroom_id: "",
      date: "",
      start_time: "",
    });
  };

  const parseListInput = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const getErrorMessage = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") return data.detail;
      if (Array.isArray(data?.detail)) {
        return data.detail.map((item: any) => item?.msg || "Invalid input").join(", ");
      }
      if (typeof data?.message === "string") return data.message;
      return fallback;
    } catch {
      return fallback;
    }
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTimeString = (totalMinutes: number) => {
    const normalizedMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = Math.floor(normalizedMinutes / 60);
    const minutes = normalizedMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const showtimesOverlap = (
    startA: string,
    endA: string,
    startB: string,
    endB: string
  ) => {
    const startAMins = timeToMinutes(startA);
    const endAMins = timeToMinutes(endA);
    const startBMins = timeToMinutes(startB);
    const endBMins = timeToMinutes(endB);

    return startAMins < endBMins && endAMins > startBMins;
  };

  const fetchUsers = async (): Promise<User[]> => {
    if (!token) {
      throw new Error("You must be logged in as an admin to load users.");
    }

    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to load users."));
    }

    const data = await response.json();
    return Array.isArray(data) ? data.map(normalizeUser) : [];
  };

  const fetchMovies = async (): Promise<Movie[]> => {
    const response = await fetch(`${API_BASE}/movies`);
    if (!response.ok) {
      throw new Error("Failed to load movies.");
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const fetchShowrooms = async (): Promise<Showroom[]> => {
    const response = await fetch(`${API_BASE}/showrooms`);
    if (!response.ok) {
      throw new Error("Failed to load showrooms.");
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const fetchAllShowtimes = async (movieList: Movie[]): Promise<Showtime[]> => {
    const results = await Promise.all(
      movieList.map(async (movie) => {
        try {
          const response = await fetch(`${API_BASE}/movies/${movie.id}/showtimes`);
          if (!response.ok) return [];

          const data = await response.json();
          if (!Array.isArray(data)) return [];

          return data.map((showtime: Showtime) => ({
            ...showtime,
            movie_title: movie.title,
          }));
        } catch {
          return [];
        }
      })
    );

    return results.flat();
  };

  const loadAdminData = async () => {
    setLoading(true);
    setLoadingUsers(true);

    try {
      const [userData, movieData, showroomData] = await Promise.all([
        fetchUsers(),
        fetchMovies(),
        fetchShowrooms(),
      ]);

      setUsers(userData);
      setMovies(movieData);
      setShowrooms(showroomData);

      const showtimeData = await fetchAllShowtimes(movieData);
      setShowtimes(showtimeData);

      if (showroomData.length < 3) {
        setErrorMessage(
          "Warning: fewer than 3 showrooms were found in the database. Your rubric requires at least 3 showrooms."
        );
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const openAddUserModal = () => {
    resetMessages();
    resetUserForm();
    setShowUserModal(true);
  };

  const openEditUserModal = (user: User) => {
    resetMessages();
    setEditingUserId(user.id);
    setAttemptedUserSubmit(false);
    setNewUser({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      role: user.role || "",
      status: user.status || "",
    });
    setShowUserModal(true);
  };

  const userNameInvalid = attemptedUserSubmit && !newUser.name.trim();
  const userEmailInvalid = attemptedUserSubmit && !newUser.email.trim();
  const userUsernameInvalid = attemptedUserSubmit && !newUser.username.trim();
  const userPasswordInvalid =
    attemptedUserSubmit && !editingUserId && !newUser.password.trim();
  const userRoleInvalid = attemptedUserSubmit && !newUser.role.trim();
  const userStatusInvalid = attemptedUserSubmit && !newUser.status.trim();

  const movieTitleInvalid = attemptedMovieSubmit && !newMovie.title.trim();
  const movieDescriptionInvalid = attemptedMovieSubmit && !newMovie.description.trim();
  const movieRatingInvalid = attemptedMovieSubmit && !newMovie.rating.trim();
  const movieDurationInvalid = attemptedMovieSubmit && !newMovie.duration_minutes.trim();

  const promoMovieTitleInvalid = attemptedPromoSubmit && !newPromo.movieTitle.trim();
  const promoDiscountInvalid = attemptedPromoSubmit && !newPromo.discount.trim();

  const showtimeMovieInvalid = attemptedShowtimeSubmit && !newShowtime.movie_id.trim();
  const showtimeShowroomInvalid =
    attemptedShowtimeSubmit && !newShowtime.showroom_id.trim();
  const showtimeDateInvalid = attemptedShowtimeSubmit && !newShowtime.date.trim();
  const showtimeStartTimeInvalid =
    attemptedShowtimeSubmit && !newShowtime.start_time.trim();

  const getFieldStyle = (isInvalid: boolean): React.CSSProperties => ({
    ...(isInvalid ? styles.inputError : {}),
  });

  const getTextareaStyle = (isInvalid: boolean): React.CSSProperties => ({
    ...(isInvalid ? styles.inputError : {}),
  });

  const renderLabel = (
    label: string,
    isRequired = false,
    isInvalid = false
  ) => (
    <label style={styles.label}>
      {label}
      {isRequired ? <span style={styles.requiredAsterisk}> *</span> : null}
      {isInvalid ? <span style={styles.requiredText}> Required</span> : null}
    </label>
  );

  const handleSaveUser = async () => {
    resetMessages();
    setAttemptedUserSubmit(true);

    if (
      !newUser.name.trim() ||
      !newUser.email.trim() ||
      !newUser.username.trim() ||
      !newUser.role.trim() ||
      !newUser.status.trim() ||
      (!editingUserId && !newUser.password.trim())
    ) {
      setErrorMessage("Please complete all required user fields.");
      return;
    }

    if (!token) {
      setErrorMessage("You must be logged in as an admin to manage users.");
      return;
    }

    const payload: Record<string, any> = {
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      username: newUser.username.trim(),
      role: newUser.role.trim(),
      status: newUser.status.trim(),
    };

    if (newUser.password.trim()) {
      payload.password = newUser.password.trim();
    }

    try {
      setSubmittingUser(true);

      const isEditing = Boolean(editingUserId);
      const url = isEditing
        ? `${API_BASE}/admin/users/${editingUserId}`
        : `${API_BASE}/admin/users`;

      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await getErrorMessage(
          response,
          isEditing ? "Failed to update user." : "Failed to add user."
        );
        setErrorMessage(message);
        return;
      }

      const savedUser = normalizeUser(await response.json());

      if (isEditing) {
        setUsers((prev) =>
          prev.map((user) => (user.id === savedUser.id ? savedUser : user))
        );
        setSuccessMessage("User updated successfully.");
      } else {
        setUsers((prev) => [...prev, savedUser]);
        setSuccessMessage("User added successfully.");
      }

      closeUserModal();
    } catch (error) {
      console.error(error);
      setErrorMessage(editingUserId ? "Failed to update user." : "Failed to add user.");
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleAddMovie = async () => {
    resetMessages();
    setAttemptedMovieSubmit(true);

    if (
      !newMovie.title.trim() ||
      !newMovie.description.trim() ||
      !newMovie.rating.trim() ||
      !newMovie.duration_minutes.trim()
    ) {
      setErrorMessage("Please complete all required movie fields.");
      return;
    }

    const duration = Number(newMovie.duration_minutes);

    if (!Number.isInteger(duration) || duration <= 0) {
      setErrorMessage("Duration must be a valid number of minutes.");
      return;
    }

    if (!token) {
      setErrorMessage("You must be logged in as an admin to add a movie.");
      return;
    }

    const payload = {
      title: newMovie.title.trim(),
      description: newMovie.description.trim(),
      trailer: newMovie.trailer.trim() || null,
      poster: newMovie.poster.trim() || null,
      rating: newMovie.rating.trim(),
      genre: parseListInput(newMovie.genreInput),
      duration_minutes: duration,
      cast: parseListInput(newMovie.castInput),
      currentlyPlaying: newMovie.currentlyPlaying,
    };

    try {
      setSubmittingMovie(true);

      const response = await fetch(`${API_BASE}/admin/movies`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await getErrorMessage(response, "Failed to add movie.");
        setErrorMessage(message);
        return;
      }

      const createdMovie: Movie = await response.json();

      setMovies((prev) => [...prev, createdMovie]);
      setSuccessMessage("Movie added successfully.");
      closeMovieModal();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to add movie.");
    } finally {
      setSubmittingMovie(false);
    }
  };

  const handleAddPromotion = () => {
    resetMessages();
    setAttemptedPromoSubmit(true);

    if (!newPromo.movieTitle.trim() || !newPromo.discount.trim()) {
      setErrorMessage("Please complete all promotion fields.");
      return;
    }

    const promoToAdd: Promotion = {
      ...newPromo,
      id: Date.now().toString(),
      movieTitle: newPromo.movieTitle.trim(),
      discount: newPromo.discount.trim(),
    };

    setPromotions((prev) => [...prev, promoToAdd]);
    setSuccessMessage("Promotion added successfully.");
    closePromoModal();
  };

  const handleAddShowtime = async () => {
    resetMessages();
    setAttemptedShowtimeSubmit(true);

    if (
      !newShowtime.movie_id.trim() ||
      !newShowtime.showroom_id.trim() ||
      !newShowtime.date.trim() ||
      !newShowtime.start_time.trim()
    ) {
      setErrorMessage("Please complete all showtime fields.");
      return;
    }

    if (!token) {
      setErrorMessage("You must be logged in as an admin to add a showtime.");
      return;
    }

    const selectedMovie = movies.find((movie) => movie.id === newShowtime.movie_id);

    if (!selectedMovie) {
      setErrorMessage("Selected movie could not be found.");
      return;
    }

    const proposedStart = newShowtime.start_time;
    const proposedEnd = minutesToTimeString(
      timeToMinutes(proposedStart) + selectedMovie.duration_minutes
    );

    const conflictingShowtime = showtimes.find((existingShowtime) => {
      const sameShowroom = existingShowtime.showroom_id === newShowtime.showroom_id;
      const sameDate = existingShowtime.date === newShowtime.date;

      if (!sameShowroom || !sameDate) {
        return false;
      }

      return showtimesOverlap(
        proposedStart,
        proposedEnd,
        existingShowtime.start_time,
        existingShowtime.end_time
      );
    });

    if (conflictingShowtime) {
      setErrorMessage(
        `This showroom is already booked on ${newShowtime.date} from ${conflictingShowtime.start_time} to ${conflictingShowtime.end_time}. Please choose a different showroom or time.`
      );
      return;
    }

    const payload = {
      movie_id: newShowtime.movie_id,
      showroom_id: newShowtime.showroom_id,
      date: newShowtime.date,
      start_time: newShowtime.start_time,
    };

    try {
      setSubmittingShowtime(true);

      const response = await fetch(`${API_BASE}/admin/showtimes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await getErrorMessage(response, "Failed to add showtime.");
        setErrorMessage(message);
        return;
      }

      const createdShowtime: Showtime = await response.json();

      const enrichedShowtime: Showtime = {
        ...createdShowtime,
        movie_title: movieTitleById[createdShowtime.movie_id] || "Selected Movie",
        showroom_name:
          createdShowtime.showroom_name ||
          showroomNameById[createdShowtime.showroom_id] ||
          "Selected Showroom",
      };

      setShowtimes((prev) =>
        [...prev, enrichedShowtime].sort((a, b) => {
          const aValue = `${a.date} ${a.start_time}`;
          const bValue = `${b.date} ${b.start_time}`;
          return aValue.localeCompare(bValue);
        })
      );

      setMovies((prev) =>
        prev.map((movie) => {
          if (movie.id !== newShowtime.movie_id) {
            return movie;
          }

          const currentDates = Array.isArray(movie.datesPlaying) ? movie.datesPlaying : [];
          const updatedDates = currentDates.includes(newShowtime.date)
            ? currentDates
            : [...currentDates, newShowtime.date].sort((a, b) => a.localeCompare(b));

          return {
            ...movie,
            currentlyPlaying: true,
            datesPlaying: updatedDates,
          };
        })
      );

      setSuccessMessage("Showtime added successfully.");
      closeShowtimeModal();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to add showtime.");
    } finally {
      setSubmittingShowtime(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    resetMessages();

    if (!token) {
      setErrorMessage("You must be logged in as an admin to delete users.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) {
        const message = await getErrorMessage(response, "Failed to remove user.");
        setErrorMessage(message);
        return;
      }

      setUsers((prev) => prev.filter((user) => user.id !== id));
      setSuccessMessage("User removed.");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to remove user.");
    }
  };

  const handleDeleteMovie = (id: string) => {
    resetMessages();
    setMovies((prev) => prev.filter((movie) => movie.id !== id));
    setShowtimes((prev) => prev.filter((showtime) => showtime.movie_id !== id));
    setSuccessMessage("Movie removed from the page.");
  };

  const handleDeletePromotion = (id: string) => {
    resetMessages();
    setPromotions((prev) => prev.filter((promo) => promo.id !== id));
    setSuccessMessage("Promotion removed.");
  };

  const handleDeleteShowtime = (id: string) => {
    resetMessages();
    setShowtimes((prev) => prev.filter((showtime) => showtime.id !== id));
    setSuccessMessage("Showtime removed from the page.");
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay} />

      <div style={styles.wrapper}>
        <div style={styles.container}>
          <div style={styles.headerBlock}>
            <p style={styles.eyebrow}>ADMIN PORTAL</p>
            <h1 style={styles.title}>Admin Management</h1>
            <p style={styles.subtitle}>
              Manage users, movies, promotions, and showtimes from one clean dashboard.
            </p>
          </div>

          {(errorMessage || successMessage) && (
            <div style={styles.messageArea}>
              {errorMessage ? <div style={styles.errorBanner}>{errorMessage}</div> : null}
              {successMessage ? (
                <div style={styles.successBanner}>{successMessage}</div>
              ) : null}
            </div>
          )}

          <div style={styles.topButtonRow}>
            <button onClick={openAddUserModal} style={styles.primaryBtn}>
              + Add User
            </button>

            <button
              onClick={() => {
                resetMessages();
                setShowMovieModal(true);
              }}
              style={styles.primaryBtn}
            >
              + Add Movie
            </button>

            <button
              onClick={() => {
                resetMessages();
                setShowPromoModal(true);
              }}
              style={styles.secondaryBtn}
            >
              + Add Promotion
            </button>

            <button
              onClick={() => {
                resetMessages();
                setShowShowtimeModal(true);
              }}
              style={styles.secondaryBtn}
            >
              + Add Showtime
            </button>
          </div>

          <div style={styles.grid}>
            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Users</h2>
                  <p style={styles.sectionMeta}>
                    {loadingUsers ? "Loading..." : userCountText}
                  </p>
                </div>
                <button onClick={openAddUserModal} style={styles.smallActionBtn}>
                  Add
                </button>
              </div>

              {users.length === 0 ? (
                <div style={styles.emptyState}>
                  {loadingUsers
                    ? "Loading users..."
                    : "No users found in the database."}
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {users.map((user) => (
                    <div key={user.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{user.name || "Unnamed User"}</h3>
                          <p style={styles.itemSubtext}>{user.email}</p>
                          <p style={styles.itemSubtext}>Username: {user.username || "N/A"}</p>
                          <p style={styles.itemSubtext}>
                            {user.role} • {user.status}
                          </p>
                        </div>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => openEditUserModal(user)}
                          style={styles.editBtn}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Movies</h2>
                  <p style={styles.sectionMeta}>
                    {loading ? "Loading..." : movieCountText}
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowMovieModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {movies.length === 0 ? (
                <div style={styles.emptyState}>
                  {loading
                    ? "Loading movies..."
                    : "No movies added yet. Click Add Movie to create one."}
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {movies.map((movie) => (
                    <div key={movie.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{movie.title}</h3>
                          <p style={styles.itemSubtext}>Rating: {movie.rating || "N/A"}</p>
                          <p style={styles.itemSubtext}>
                            Duration: {movie.duration_minutes || 0} min
                          </p>
                          <p style={styles.itemSubtext}>
                            Genres: {movie.genre.length ? movie.genre.join(", ") : "None"}
                          </p>
                          <p style={styles.itemSubtext}>
                            Dates Playing:{" "}
                            {movie.datesPlaying && movie.datesPlaying.length > 0
                              ? movie.datesPlaying.join(", ")
                              : "None"}
                          </p>
                        </div>
                        <span style={styles.badge}>{movie.rating || "NR"}</span>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeleteMovie(movie.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Promotions</h2>
                  <p style={styles.sectionMeta}>{promoCountText}</p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowPromoModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {promotions.length === 0 ? (
                <div style={styles.emptyState}>
                  No promotions added yet. Click <strong>Add Promotion</strong> to create one.
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {promotions.map((promo) => (
                    <div key={promo.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{promo.movieTitle}</h3>
                          <p style={styles.itemSubtext}>Discount offer</p>
                        </div>
                        <span style={styles.discountBadge}>{promo.discount}% OFF</span>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Showtimes</h2>
                  <p style={styles.sectionMeta}>
                    {loading ? "Loading..." : showtimeCountText}
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowShowtimeModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {showtimes.length === 0 ? (
                <div style={styles.emptyState}>
                  {loading
                    ? "Loading showtimes..."
                    : "No showtimes added yet. Click Add Showtime to create one."}
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {showtimes.map((showtime) => (
                    <div key={showtime.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>
                            {showtime.movie_title ||
                              movieTitleById[showtime.movie_id] ||
                              "Movie"}
                          </h3>
                          <p style={styles.itemSubtext}>
                            {showtime.date} at {showtime.start_time}
                          </p>
                          <p style={styles.itemSubtext}>Ends at {showtime.end_time}</p>
                          <p style={styles.itemSubtext}>
                            Auditorium:{" "}
                            {showtime.showroom_name ||
                              showroomNameById[showtime.showroom_id] ||
                              "Unknown"}
                          </p>
                        </div>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeleteShowtime(showtime.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showUserModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingUserId ? "Edit User" : "Add User"}
              </h3>
              <p style={styles.modalSubtitle}>
                {editingUserId
                  ? "Update the user details below."
                  : "Enter the user details below."}
              </p>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Full Name", true, userNameInvalid)}
              <input
                type="text"
                placeholder="Enter full name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(userNameInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Email", true, userEmailInvalid)}
              <input
                type="email"
                placeholder="Enter email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(userEmailInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Username", true, userUsernameInvalid)}
              <input
                type="text"
                placeholder="Enter username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(userUsernameInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel(
                editingUserId ? "Password (leave blank to keep current)" : "Password",
                !editingUserId,
                userPasswordInvalid
              )}
              <input
                type="password"
                placeholder={
                  editingUserId ? "Leave blank to keep current password" : "Enter password"
                }
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(userPasswordInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Role", true, userRoleInvalid)}
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(userRoleInvalid) }}
              >
                <option value="">Select role</option>
                <option value="Admin">Admin</option>
                <option value="Customer">Customer</option>
                <option value="Manager">Manager</option>
              </select>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Status", true, userStatusInvalid)}
              <select
                value={newUser.status}
                onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(userStatusInvalid) }}
              >
                <option value="">Select status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closeUserModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                style={styles.modalPrimaryBtn}
                disabled={submittingUser}
              >
                {submittingUser
                  ? editingUserId
                    ? "Saving..."
                    : "Creating..."
                  : editingUserId
                  ? "Save Changes"
                  : "Save User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMovieModal && (
        <div
          style={{
            ...styles.modalOverlay,
          }}
        >
          <div
            style={{
              ...styles.modal,
              maxWidth: "520px",
              maxHeight: "calc(100vh - 120px)",
              overflowY: "auto",
            }}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Movie</h3>
              <p style={styles.modalSubtitle}>Enter the movie details below.</p>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Movie Title", true, movieTitleInvalid)}
              <input
                type="text"
                placeholder="Enter movie title"
                value={newMovie.title}
                onChange={(e) => setNewMovie({ ...newMovie, title: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(movieTitleInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Description", true, movieDescriptionInvalid)}
              <textarea
                placeholder="Enter movie description"
                value={newMovie.description}
                onChange={(e) =>
                  setNewMovie({ ...newMovie, description: e.target.value })
                }
                style={{ ...styles.textarea, ...getTextareaStyle(movieDescriptionInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Age Rating", true, movieRatingInvalid)}
              <select
                value={newMovie.rating}
                onChange={(e) => setNewMovie({ ...newMovie, rating: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(movieRatingInvalid) }}
              >
                <option value="">Select age rating</option>
                <option value="G">G</option>
                <option value="PG">PG</option>
                <option value="PG-13">PG-13</option>
                <option value="R">R</option>
                <option value="NC-17">NC-17</option>
              </select>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Genre")}
              <input
                type="text"
                placeholder="Animation, Adventure, Comedy"
                value={newMovie.genreInput}
                onChange={(e) =>
                  setNewMovie({ ...newMovie, genreInput: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Duration (Minutes)", true, movieDurationInvalid)}
              <input
                type="number"
                placeholder="e.g. 98"
                value={newMovie.duration_minutes}
                onChange={(e) =>
                  setNewMovie({ ...newMovie, duration_minutes: e.target.value })
                }
                style={{ ...styles.input, ...getFieldStyle(movieDurationInvalid) }}
                min={1}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Cast")}
              <input
                type="text"
                placeholder="Actor One, Actor Two"
                value={newMovie.castInput}
                onChange={(e) =>
                  setNewMovie({ ...newMovie, castInput: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Poster URL")}
              <input
                type="text"
                placeholder="https://..."
                value={newMovie.poster}
                onChange={(e) => setNewMovie({ ...newMovie, poster: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Trailer URL")}
              <input
                type="text"
                placeholder="https://..."
                value={newMovie.trailer}
                onChange={(e) => setNewMovie({ ...newMovie, trailer: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.checkboxRow}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={newMovie.currentlyPlaying}
                  onChange={(e) =>
                    setNewMovie({
                      ...newMovie,
                      currentlyPlaying: e.target.checked,
                    })
                  }
                  style={styles.checkbox}
                />
                Currently Playing
              </label>
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closeMovieModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button
                onClick={handleAddMovie}
                style={styles.modalPrimaryBtn}
                disabled={submittingMovie}
              >
                {submittingMovie ? "Saving..." : "Save Movie"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPromoModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Promotion</h3>
              <p style={styles.modalSubtitle}>Create a discount for a movie.</p>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Movie Title", true, promoMovieTitleInvalid)}
              <input
                type="text"
                placeholder="Enter movie title"
                value={newPromo.movieTitle}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, movieTitle: e.target.value })
                }
                style={{ ...styles.input, ...getFieldStyle(promoMovieTitleInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Discount %", true, promoDiscountInvalid)}
              <input
                type="number"
                placeholder="e.g. 15"
                value={newPromo.discount}
                onChange={(e) => setNewPromo({ ...newPromo, discount: e.target.value })}
                style={{ ...styles.input, ...getFieldStyle(promoDiscountInvalid) }}
              />
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closePromoModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button onClick={handleAddPromotion} style={styles.modalPrimaryBtn}>
                Save Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {showShowtimeModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Showtime</h3>
              <p style={styles.modalSubtitle}>Enter the showtime details below.</p>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Movie", true, showtimeMovieInvalid)}
              <select
                value={newShowtime.movie_id}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, movie_id: e.target.value })
                }
                style={{ ...styles.input, ...getFieldStyle(showtimeMovieInvalid) }}
              >
                <option value="">Select movie</option>
                {movies.map((movie) => (
                  <option key={movie.id} value={movie.id}>
                    {movie.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Showroom", true, showtimeShowroomInvalid)}
              <select
                value={newShowtime.showroom_id}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, showroom_id: e.target.value })
                }
                style={{ ...styles.input, ...getFieldStyle(showtimeShowroomInvalid) }}
              >
                <option value="">Select showroom</option>
                {showrooms.map((showroom) => (
                  <option key={showroom.id} value={showroom.id}>
                    {showroom.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Date", true, showtimeDateInvalid)}
              <input
                type="date"
                value={newShowtime.date}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, date: e.target.value })
                }
                style={{ ...styles.input, ...getFieldStyle(showtimeDateInvalid) }}
              />
            </div>

            <div style={styles.fieldGroup}>
              {renderLabel("Start Time", true, showtimeStartTimeInvalid)}
              <input
                type="time"
                value={newShowtime.start_time}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, start_time: e.target.value })
                }
                style={{ ...styles.input, ...getFieldStyle(showtimeStartTimeInvalid) }}
              />
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closeShowtimeModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button
                onClick={handleAddShowtime}
                style={styles.modalPrimaryBtn}
                disabled={submittingShowtime}
              >
                {submittingShowtime ? "Saving..." : "Save Showtime"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
  },

  bg: {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: -2,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.58)",
    zIndex: -1,
  },

  wrapper: {
    minHeight: "calc(100vh - 70px)",
    marginTop: 70,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "36px 24px",
    boxSizing: "border-box",
  },

  container: {
    width: "100%",
    maxWidth: "1200px",
    padding: "30px",
    borderRadius: "22px",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    background: "rgba(8, 8, 12, 0.78)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 55px rgba(0,0,0,0.45)",
    color: "white",
  },

  headerBlock: {
    textAlign: "center",
    marginBottom: "24px",
  },

  eyebrow: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: 1.6,
    opacity: 0.72,
    fontWeight: 700,
  },

  title: {
    margin: "8px 0 10px 0",
    fontSize: "38px",
    fontWeight: 800,
  },

  subtitle: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.8)",
  },

  messageArea: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "18px",
  },

  errorBanner: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "rgba(255, 93, 93, 0.14)",
    border: "1px solid rgba(255, 93, 93, 0.35)",
    color: "#ff9d9d",
    fontSize: "14px",
    textAlign: "center",
  },

  successBanner: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "rgba(89, 214, 123, 0.14)",
    border: "1px solid rgba(89, 214, 123, 0.35)",
    color: "#9ef0b3",
    fontSize: "14px",
    textAlign: "center",
  },

  topButtonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "26px",
  },

  primaryBtn: {
    padding: "13px 18px",
    borderRadius: "12px",
    border: "none",
    background: "white",
    color: "black",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
    minWidth: "150px",
  },

  secondaryBtn: {
    padding: "13px 18px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
    minWidth: "150px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },

  sectionCard: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    minHeight: "320px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
  },

  sectionMeta: {
    margin: "4px 0 0 0",
    fontSize: "12px",
    color: "rgba(255,255,255,0.68)",
  },

  smallActionBtn: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },

  emptyState: {
    borderRadius: "14px",
    padding: "18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px dashed rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.74)",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  itemsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  itemCard: {
    padding: "16px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  itemTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },

  itemTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    color: "white",
  },

  itemSubtext: {
    margin: "6px 0 0 0",
    fontSize: "13px",
    color: "rgba(255,255,255,0.72)",
  },

  badge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  discountBadge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(101, 214, 132, 0.16)",
    border: "1px solid rgba(101, 214, 132, 0.28)",
    color: "#b9f5c7",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  itemActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },

  editBtn: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.12)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },

  deleteBtn: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "90px 20px 24px 20px",
    zIndex: 20,
    overflowY: "auto",
  },

  modal: {
    width: "100%",
    maxWidth: "420px",
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    background: "rgba(10,10,14,0.94)",
    padding: "24px",
    borderRadius: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 12px 34px rgba(0,0,0,0.45)",
    color: "white",
  },

  modalHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "4px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 800,
  },

  modalSubtitle: {
    margin: 0,
    fontSize: "13px",
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.5,
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "12px",
    fontWeight: 700,
    color: "white",
    letterSpacing: 0.4,
  },

  requiredText: {
    color: "#ff8f8f",
    fontWeight: 700,
    fontSize: "12px",
  },

  requiredAsterisk: {
    color: "#ff4d4f",
    fontWeight: 900,
  },

  input: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: "14px",
  },

  textarea: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: "14px",
    minHeight: "90px",
    resize: "vertical",
    fontFamily: "inherit",
  },

  inputError: {
    border: "1px solid #ff4d4f",
    boxShadow: "0 0 0 1px rgba(255,77,79,0.18)",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    marginTop: "2px",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "white",
    cursor: "pointer",
  },

  checkbox: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },

  modalBtns: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "6px",
  },

  modalPrimaryBtn: {
    padding: "12px 16px",
    background: "white",
    color: "black",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
  },

  modalSecondaryBtn: {
    padding: "12px 16px",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
  },
};