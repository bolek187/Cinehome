const state = {
  movies: [],
  favorites: [],
  wishlist: [],
  ratings: {},
  activeTab: 'movies',
  search: '',
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  selectedMovie: null,
  hls: null
};

const els = {
  moviesGrid: document.getElementById('moviesGrid'),
  favoritesGrid: document.getElementById('favoritesGrid'),
  wishlistList: document.getElementById('wishlistList'),
  moviesEmpty: document.getElementById('moviesEmpty'),
  favoritesEmpty: document.getElementById('favoritesEmpty'),
  wishlistEmpty: document.getElementById('wishlistEmpty'),
  searchInput: document.getElementById('searchInput'),
  tabButtons: [...document.querySelectorAll('.tab-button')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  modal: document.getElementById('playerModal'),
  player: document.getElementById('player'),
  playerTitle: document.getElementById('playerTitle'),
  closePlayer: document.getElementById('closePlayer'),
  openWishlistForm: document.getElementById('openWishlistForm'),
  wishlistForm: document.getElementById('wishlistForm'),
  cancelWishlistForm: document.getElementById('cancelWishlistForm'),
  themeToggle: document.querySelector('[data-theme-toggle]'),
  statAll: document.getElementById('statAll'),
  statFavorites: document.getElementById('statFavorites'),
  statWishlist: document.getElementById('statWishlist'),
  heroCover: document.getElementById('heroCover'),
  heroMovieTitle: document.getElementById('heroMovieTitle'),
  heroRatingStars: document.getElementById('heroRatingStars'),
  heroRatingValue: document.getElementById('heroRatingValue'),
  heroPlayButton: document.getElementById('heroPlayButton')
};

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function starIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 17.27 5.18 3.13-1.38-5.9L20.4 10l-6.05-.52L12 4l-2.35 5.48L3.6 10l4.6 4.5-1.38 5.9L12 17.27Z"/></svg>`;
}

function fallbackCover(title) {
  const safe = String(title || 'Film').slice(0, 30)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 960">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="640" height="960" fill="url(#g)"/>
      <circle cx="320" cy="280" r="116" fill="rgba(255,255,255,0.08)"/>
      <path d="M284 220 L396 280 L284 340 Z" fill="#fff" opacity="0.92"/>
      <text x="320" y="760" fill="#fff" font-size="42" font-family="Inter,Arial,sans-serif" font-weight="700" text-anchor="middle">${safe}</text>
    </svg>
  `)}`;
}

function normalizeMovie(movie) {
  const id = movie.id || movie.slug || movie.title;
  return {
    id,
    title: movie.title || 'Ohne Titel',
    video: movie.video || '',
    cover: movie.cover || fallbackCover(movie.title),
    rating: Number(movie.rating || 0)
  };
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${text || response.statusText}`);
  }
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
}

async function safeApi(url, fallback) {
  try {
    const data = await api(url);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

function favoriteIds() {
  return new Set(state.favorites.map(item => item.id || item.title));
}

function filteredMovies(source = state.movies) {
  const term = state.search.trim().toLowerCase();
  if (!term) return source;
  return source.filter(movie => String(movie.title).toLowerCase().includes(term));
}

function getMovieById(id) {
  return state.movies.find(movie => movie.id === id);
}

function createImage(movie) {
  const img = document.createElement('img');
  img.className = 'movie-cover';
  img.alt = `Cover von ${movie.title}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = movie.cover || fallbackCover(movie.title);
  img.addEventListener('error', () => {
    img.src = fallbackCover(movie.title);
  }, { once: true });
  return img;
}

function renderStats() {
  els.statAll.textContent = state.movies.length;
  els.statFavorites.textContent = state.favorites.length;
  els.statWishlist.textContent = state.wishlist.length;
}

function renderTabs() {
  els.tabButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.tabTarget === state.activeTab);
  });
  els.tabPanels.forEach(panel => {
    panel.classList.toggle('is-active', panel.id === `tab-${state.activeTab}`);
  });
}

function renderHero() {
  const movie = state.selectedMovie || state.movies[0] || null;
  state.selectedMovie = movie;

  if (!movie) {
    els.heroCover.src = fallbackCover('CineHome');
    els.heroMovieTitle.textContent = 'Noch kein Film geladen';
    els.heroRatingStars.innerHTML = '';
    els.heroRatingValue.textContent = 'Nicht bewertet';
    els.heroPlayButton.disabled = true;
    return;
  }

  els.heroCover.src = movie.cover || fallbackCover(movie.title);
  els.heroMovieTitle.textContent = movie.title;
  els.heroPlayButton.disabled = false;
  renderRating();
}

function movieCard(movie, isFavorite) {
  const article = document.createElement('article');
  article.className = `movie-card ${state.selectedMovie?.id === movie.id ? 'is-selected' : ''}`;

  const playButton = document.createElement('button');
  playButton.className = 'play-button';
  playButton.type = 'button';
  playButton.setAttribute('aria-label', `${movie.title} auswählen und abspielen`);

  const wrap = document.createElement('div');
  wrap.className = 'movie-cover-wrap';
  wrap.appendChild(createImage(movie));
  const overlay = document.createElement('div');
  overlay.className = 'movie-overlay';
  overlay.textContent = '▶ Abspielen';
  wrap.appendChild(overlay);

  const meta = document.createElement('div');
  meta.className = 'movie-meta';
  const textWrap = document.createElement('div');
  textWrap.innerHTML = `<h4 class="movie-title"></h4><p class="movie-subtitle"></p>`;
  textWrap.querySelector('.movie-title').textContent = movie.title;
  const rating = Number(state.ratings[movie.id] || movie.rating || 0);
  textWrap.querySelector('.movie-subtitle').textContent = rating > 0 ? `${rating}/10 bewertet` : 'Zum Abspielen klicken';

  const favoriteButton = document.createElement('button');
  favoriteButton.className = `favorite-toggle ${isFavorite ? 'is-active' : ''}`;
  favoriteButton.type = 'button';
  favoriteButton.setAttribute('aria-label', isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren');
  favoriteButton.innerHTML = starIcon();

  favoriteButton.addEventListener('click', async event => {
    event.stopPropagation();
    await toggleFavorite(movie);
  });

  playButton.append(wrap, meta);
  meta.append(textWrap, favoriteButton);
  playButton.addEventListener('click', () => {
    state.selectedMovie = movie;
    renderHero();
    renderCollections();
    openPlayer(movie);
  });

  article.appendChild(playButton);
  return article;
}

function renderCollection(target, items, emptyElement) {
  target.replaceChildren(...items);
  emptyElement.classList.toggle('hidden', items.length > 0);
}

function renderCollections() {
  const favoritesSet = favoriteIds();
  const movies = filteredMovies(state.movies).map(movie => movieCard(movie, favoritesSet.has(movie.id)));
  const favoritesSource = state.favorites
    .map(item => getMovieById(item.id || item.title) || normalizeMovie(item))
    .filter(Boolean);
  const favorites = filteredMovies(favoritesSource).map(movie => movieCard(movie, true));

  renderCollection(els.moviesGrid, movies, els.moviesEmpty);
  renderCollection(els.favoritesGrid, favorites, els.favoritesEmpty);
}

function renderWishlist() {
  const term = state.search.trim().toLowerCase();
  const items = [...state.wishlist]
    .filter(item => !term || String(item.title).toLowerCase().includes(term))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'de'));

  const cards = items.map(item => {
    const article = document.createElement('article');
    article.className = 'wishlist-item';
    article.innerHTML = `
      <div class="wishlist-top">
        <div><h4 class="movie-title"></h4></div>
        <span class="wishlist-year"></span>
      </div>
      <p class="wishlist-note"></p>
      <div class="wishlist-actions"><button class="wishlist-delete" type="button">Entfernen</button></div>
    `;
    article.querySelector('.movie-title').textContent = item.title;
    article.querySelector('.wishlist-year').textContent = item.year || '—';
    article.querySelector('.wishlist-note').textContent = item.note || 'Keine Notiz hinterlegt.';
    article.querySelector('.wishlist-delete').addEventListener('click', async () => {
      await api('/api/wishlist', { method: 'DELETE', body: JSON.stringify({ id: item.id }) });
      state.wishlist = state.wishlist.filter(entry => entry.id !== item.id);
      renderStats();
      renderWishlist();
    });
    return article;
  });

  els.wishlistList.replaceChildren(...cards);
  els.wishlistEmpty.classList.toggle('hidden', cards.length > 0);
}

function renderRating() {
  const movie = state.selectedMovie;
  els.heroRatingStars.innerHTML = '';
  if (!movie) {
    els.heroRatingValue.textContent = 'Nicht bewertet';
    return;
  }

  const current = Number(state.ratings[movie.id] || movie.rating || 0);
  for (let i = 1; i <= 10; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rating-star ${i <= current ? 'active' : ''}`;
    button.setAttribute('aria-label', `${i} von 10 Sternen`);
    button.textContent = '★';
    button.addEventListener('click', () => saveRating(movie.id, i));
    els.heroRatingStars.appendChild(button);
  }
  els.heroRatingValue.textContent = current > 0 ? `${current}/10 Sterne` : 'Nicht bewertet';
}

async function saveRating(movieId, rating) {
  await api(`/api/ratings/${encodeURIComponent(movieId)}`, {
    method: 'PUT',
    body: JSON.stringify({ rating })
  });
  state.ratings[movieId] = rating;
  const movie = getMovieById(movieId);
  if (movie) movie.rating = rating;
  renderHero();
  renderCollections();
}

function destroyHls() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
}

function openPlayer(movie) {
  if (!movie || !movie.video) return;
  state.selectedMovie = movie;
  els.playerTitle.textContent = movie.title;
  els.player.setAttribute('poster', movie.cover || fallbackCover(movie.title));
  els.modal.classList.remove('hidden');

  destroyHls();
  els.player.pause();
  els.player.removeAttribute('src');
  els.player.load();

  if (movie.video.endsWith('.m3u8') && window.Hls?.isSupported()) {
    state.hls = new window.Hls();
    state.hls.loadSource(movie.video);
    state.hls.attachMedia(els.player);
    state.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      els.player.play().catch(() => {});
    });
  } else {
    els.player.src = movie.video;
    els.player.load();
    els.player.play().catch(() => {});
  }
}

function closePlayer() {
  destroyHls();
  els.player.pause();
  els.player.removeAttribute('src');
  els.player.load();
  els.modal.classList.add('hidden');
}

async function toggleFavorite(movie) {
  const exists = state.favorites.some(item => (item.id || item.title) === movie.id);
  if (exists) {
    await api('/api/favorites', { method: 'DELETE', body: JSON.stringify({ id: movie.id, title: movie.title }) });
    state.favorites = state.favorites.filter(item => (item.id || item.title) !== movie.id);
  } else {
    const created = await api('/api/favorites', { method: 'POST', body: JSON.stringify(movie) });
    const saved = normalizeMovie(created?.movie || movie);
    state.favorites = [...state.favorites.filter(item => (item.id || item.title) !== saved.id), saved];
  }
  renderStats();
  renderCollections();
}

function renderAll() {
  renderStats();
  renderTabs();
  renderHero();
  renderCollections();
  renderWishlist();
}

async function loadData() {
  const [movies, favorites, wishlist, ratings] = await Promise.all([
    safeApi('/api/movies', []),
    safeApi('/api/favorites', []),
    safeApi('/api/wishlist', []),
    safeApi('/api/ratings', {})
  ]);

  state.movies = Array.isArray(movies) ? movies.map(normalizeMovie) : [];
  state.favorites = Array.isArray(favorites) ? favorites.map(normalizeMovie) : [];
  state.wishlist = Array.isArray(wishlist) ? wishlist : [];
  state.ratings = ratings && typeof ratings === 'object' ? ratings : {};
  state.selectedMovie = state.movies[0] || null;
  renderAll();
}

function bindEvents() {
  els.searchInput.addEventListener('input', event => {
    state.search = event.target.value;
    renderCollections();
    renderWishlist();
  });

  els.tabButtons.forEach(button => button.addEventListener('click', () => {
    state.activeTab = button.dataset.tabTarget;
    renderTabs();
  }));

  els.openWishlistForm.addEventListener('click', () => {
    els.wishlistForm.classList.remove('hidden');
    document.getElementById('wishlistTitle').focus();
  });

  els.cancelWishlistForm.addEventListener('click', () => {
    els.wishlistForm.reset();
    els.wishlistForm.classList.add('hidden');
  });

  els.wishlistForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(els.wishlistForm);
    const payload = {
      title: String(formData.get('title') || '').trim(),
      year: String(formData.get('year') || '').trim(),
      note: String(formData.get('note') || '').trim()
    };
    if (!payload.title) return;
    const created = await api('/api/wishlist', { method: 'POST', body: JSON.stringify(payload) });
    state.wishlist = [...state.wishlist, created];
    els.wishlistForm.reset();
    els.wishlistForm.classList.add('hidden');
    state.activeTab = 'wishlist';
    renderAll();
  });

  els.closePlayer.addEventListener('click', closePlayer);
  els.modal.addEventListener('click', event => {
    if (event.target === els.modal) closePlayer();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePlayer();
  });
  els.themeToggle.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  });
  els.heroPlayButton.addEventListener('click', () => {
    if (state.selectedMovie) openPlayer(state.selectedMovie);
  });
}

setTheme(state.theme);
bindEvents();
loadData().catch(error => {
  console.error(error);
  els.moviesEmpty.classList.remove('hidden');
  els.moviesEmpty.innerHTML = '<h3>Fehler beim Laden</h3><p>Bitte prüfe, ob API und nginx laufen und ob der Filmordner korrekt gefunden wird.</p>';
});
