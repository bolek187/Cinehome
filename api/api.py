from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
import json
import uuid

MOVIES_ROOT = Path('/var/www/html/filme/t7')
PUBLIC_PREFIX = '/filme/t7'
DATA_FILE = Path('/opt/cinehome/data.json')
HOST = '127.0.0.1'
PORT = 5000


def default_store():
    return {
        'favorites': [],
        'wishlist': [],
        'ratings': {}
    }


def ensure_store():
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps(default_store(), ensure_ascii=False, indent=2), encoding='utf-8')


def load_store():
    ensure_store()
    try:
        data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
        merged = default_store()
        if isinstance(data, dict):
            merged.update(data)
        return merged
    except Exception:
        return default_store()


def save_store(data):
    ensure_store()
    merged = default_store()
    merged.update(data)
    DATA_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')


def scan_movies(store=None):
    store = store or load_store()
    ratings = store.get('ratings', {})
    movies = []

    if not MOVIES_ROOT.exists():
        return movies

    for folder in sorted(MOVIES_ROOT.iterdir(), key=lambda path: path.name.lower()):
        if not folder.is_dir():
            continue

        movie_file = folder / 'movie.mp4'
        cover_file = folder / 'cover.jpeg'

        if movie_file.exists() and cover_file.exists():
            title = folder.name.replace('_', ' ')
            rel = f'{PUBLIC_PREFIX}/{folder.name}'
            movies.append({
                'id': title,
                'title': title,
                'video': f'{rel}/movie.mp4',
                'cover': f'{rel}/cover.jpeg',
                'rating': int(ratings.get(title, 0) or 0)
            })

    return movies


def movie_lookup(movies):
    by_id = {movie['id']: movie for movie in movies}
    by_title = {movie['title']: movie for movie in movies}
    return by_id, by_title


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length) if length else b'{}'
        try:
            return json.loads(raw.decode('utf-8') or '{}')
        except Exception:
            return {}

    def do_OPTIONS(self):
        self._send({}, 204)

    def do_GET(self):
        path = urlparse(self.path).path
        store = load_store()
        movies = scan_movies(store)

        if path == '/api/movies':
            return self._send(movies)
        if path == '/api/favorites':
            return self._send(store.get('favorites', []))
        if path == '/api/wishlist':
            return self._send(store.get('wishlist', []))
        if path == '/api/ratings':
            return self._send(store.get('ratings', {}))
        if path == '/api/health':
            return self._send({
                'ok': True,
                'movies_root': str(MOVIES_ROOT),
                'public_prefix': PUBLIC_PREFIX,
                'movies': len(movies)
            })

        return self._send({'error': 'Not found'}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        payload = self.read_json()
        store = load_store()
        movies = scan_movies(store)
        by_id, by_title = movie_lookup(movies)

        if path == '/api/favorites':
            movie_id = str(payload.get('id', '')).strip()
            title = str(payload.get('title', '')).strip()
            movie = by_id.get(movie_id) or by_title.get(title)
            if not movie and not title:
                return self._send({'error': 'Missing movie'}, 400)

            favorite = movie or {
                'id': title,
                'title': title,
                'video': str(payload.get('video', '')).strip(),
                'cover': str(payload.get('cover', '')).strip(),
                'rating': int(store.get('ratings', {}).get(title, 0) or 0)
            }

            favorites = [item for item in store.get('favorites', []) if item.get('title') != favorite['title']]
            favorites.append({
                'id': favorite['id'],
                'title': favorite['title'],
                'video': favorite.get('video', ''),
                'cover': favorite.get('cover', '')
            })
            store['favorites'] = favorites
            save_store(store)
            return self._send({'ok': True, 'movie': favorite}, 201)

        if path == '/api/wishlist':
            title = str(payload.get('title', '')).strip()
            if not title:
                return self._send({'error': 'Missing title'}, 400)

            entry = {
                'id': uuid.uuid4().hex,
                'title': title,
                'year': str(payload.get('year', '')).strip(),
                'note': str(payload.get('note', '')).strip()
            }
            wishlist = store.get('wishlist', [])
            wishlist.append(entry)
            store['wishlist'] = wishlist
            save_store(store)
            return self._send(entry, 201)

        return self._send({'error': 'Not found'}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        payload = self.read_json()
        store = load_store()

        if path == '/api/favorites':
            title = str(payload.get('title', '')).strip()
            movie_id = str(payload.get('id', '')).strip()
            store['favorites'] = [
                item for item in store.get('favorites', [])
                if item.get('title') not in {title, movie_id}
            ]
            save_store(store)
            return self._send({'ok': True})

        if path == '/api/wishlist':
            entry_id = str(payload.get('id', '')).strip()
            store['wishlist'] = [item for item in store.get('wishlist', []) if item.get('id') != entry_id]
            save_store(store)
            return self._send({'ok': True})

        return self._send({'error': 'Not found'}, 404)

    def do_PUT(self):
        path = urlparse(self.path).path
        payload = self.read_json()
        store = load_store()
        movies = scan_movies(store)
        by_id, by_title = movie_lookup(movies)

        if path.startswith('/api/ratings/'):
            movie_key = unquote(path.rsplit('/', 1)[-1])
            rating = int(payload.get('rating', 0) or 0)
            movie = by_id.get(movie_key) or by_title.get(movie_key)
            if not movie or rating < 0 or rating > 10:
                return self._send({'error': 'Invalid rating'}, 400)

            store['ratings'][movie['title']] = rating
            save_store(store)
            return self._send({'ok': True, 'rating': rating})

        return self._send({'error': 'Not found'}, 404)


if __name__ == '__main__':
    ensure_store()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'CineHome API running on http://{HOST}:{PORT}')
    print(f'Movies root: {MOVIES_ROOT}')
    server.serve_forever()
