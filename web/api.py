from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
import json
import uuid

MOVIES_ROOT = Path('/var/www/html/filme/t7')
DATA_FILE = Path('/opt/cinehome/data.json')
HOST = '127.0.0.1'
PORT = 5000


def default_store():
    return {'favorites': [], 'wishlist': [], 'ratings': {}, 'categories': []}


def ensure_store():
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps(default_store(), ensure_ascii=False, indent=2), encoding='utf-8')


def load_store():
    ensure_store()
    try:
        data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
    except Exception:
        data = default_store()
    merged = default_store()
    merged.update(data if isinstance(data, dict) else {})
    merged['favorites'] = merged.get('favorites') or []
    merged['wishlist'] = merged.get('wishlist') or []
    merged['ratings'] = merged.get('ratings') or {}
    merged['categories'] = merged.get('categories') or []
    return merged


def save_store(data):
    ensure_store()
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def normalize_movie_id(value):
    return str(value or '').strip()


def scan_movies():
    store = load_store()
    ratings = store.get('ratings', {})
    movies = []
    if not MOVIES_ROOT.exists():
        return movies
    for folder in sorted(MOVIES_ROOT.iterdir()):
        if not folder.is_dir():
            continue
        movie_file = folder / 'movie.mp4'
        cover_jpeg = folder / 'cover.jpeg'
        cover_jpg = folder / 'cover.jpg'
        cover_png = folder / 'cover.png'
        cover_file = cover_jpeg if cover_jpeg.exists() else cover_jpg if cover_jpg.exists() else cover_png
        if not movie_file.exists() or not cover_file.exists():
            continue
        title = folder.name.replace('_', ' ')
        rel = '/filme/t7/' + folder.name
        cover_name = cover_file.name
        movie_id = title
        rating = ratings.get(movie_id, ratings.get(title, 0))
        movies.append({
            'id': movie_id,
            'title': title,
            'video': f'{rel}/movie.mp4',
            'cover': f'{rel}/{cover_name}',
            'rating': int(rating or 0)
        })
    return movies


def json_body(handler):
    length = int(handler.headers.get('Content-Length', '0'))
    raw = handler.rfile.read(length) if length else b'{}'
    try:
        return json.loads(raw.decode('utf-8') or '{}')
    except Exception:
        return {}


def sanitize_category(payload):
    movie_ids = payload.get('movieIds', payload.get('movie_ids', []))
    if not isinstance(movie_ids, list):
        movie_ids = []
    return {
        'id': str(payload.get('id') or uuid.uuid4().hex),
        'name': str(payload.get('name', '')).strip(),
        'color': str(payload.get('color', '#ffd54a')).strip() or '#ffd54a',
        'movieIds': list(dict.fromkeys([normalize_movie_id(item) for item in movie_ids if normalize_movie_id(item)]))
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send({}, 204)

    def do_GET(self):
        path = urlparse(self.path).path
        store = load_store()
        if path == '/api/movies':
            return self._send(scan_movies())
        if path == '/api/favorites':
            return self._send(store.get('favorites', []))
        if path == '/api/wishlist':
            return self._send(store.get('wishlist', []))
        if path == '/api/ratings':
            return self._send(store.get('ratings', {}))
        if path == '/api/categories':
            return self._send(store.get('categories', []))
        return self._send({'error': 'Not found'}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        payload = json_body(self)
        store = load_store()

        if path == '/api/favorites':
            title = str(payload.get('title', '')).strip()
            movie_id = normalize_movie_id(payload.get('id') or title)
            if not title:
                return self._send({'error': 'Missing title'}, 400)
            favorites = [item for item in store.get('favorites', []) if (item.get('id') or item.get('title')) != movie_id and item.get('title') != title]
            favorites.append({
                'id': movie_id,
                'title': title,
                'video': payload.get('video', ''),
                'cover': payload.get('cover', '')
            })
            store['favorites'] = favorites
            save_store(store)
            return self._send({'ok': True}, 201)

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

        if path == '/api/categories':
            category = sanitize_category(payload)
            if not category['name'] or not category['movieIds']:
                return self._send({'error': 'Missing name or movies'}, 400)
            categories = [item for item in store.get('categories', []) if item.get('id') != category['id']]
            categories.append(category)
            store['categories'] = categories
            save_store(store)
            return self._send(category, 201)

        return self._send({'error': 'Not found'}, 404)

    def do_PUT(self):
        path = urlparse(self.path).path
        payload = json_body(self)
        store = load_store()

        if path.startswith('/api/ratings/'):
            movie_id = unquote(path.split('/api/ratings/', 1)[1]).strip()
            if not movie_id:
                return self._send({'error': 'Missing movie id'}, 400)
            rating = int(payload.get('rating', 0) or 0)
            rating = max(0, min(10, rating))
            ratings = store.get('ratings', {})
            ratings[movie_id] = rating
            store['ratings'] = ratings
            save_store(store)
            return self._send({'ok': True, 'id': movie_id, 'rating': rating})

        if path.startswith('/api/categories/'):
            category_id = unquote(path.split('/api/categories/', 1)[1]).strip()
            if not category_id:
                return self._send({'error': 'Missing category id'}, 400)
            category = sanitize_category({**payload, 'id': category_id})
            if not category['name']:
                return self._send({'error': 'Missing name'}, 400)
            categories = [item for item in store.get('categories', []) if item.get('id') != category_id]
            categories.append(category)
            store['categories'] = categories
            save_store(store)
            return self._send(category)

        return self._send({'error': 'Not found'}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        payload = json_body(self)
        store = load_store()

        if path == '/api/favorites':
            title = str(payload.get('title', '')).strip()
            movie_id = normalize_movie_id(payload.get('id') or title)
            store['favorites'] = [
                item for item in store.get('favorites', [])
                if (item.get('id') or item.get('title')) != movie_id and item.get('title') != title
            ]
            save_store(store)
            return self._send({'ok': True})

        if path == '/api/wishlist':
            entry_id = str(payload.get('id', '')).strip()
            store['wishlist'] = [item for item in store.get('wishlist', []) if item.get('id') != entry_id]
            save_store(store)
            return self._send({'ok': True})

        if path.startswith('/api/categories/'):
            category_id = unquote(path.split('/api/categories/', 1)[1]).strip()
            store['categories'] = [item for item in store.get('categories', []) if item.get('id') != category_id]
            save_store(store)
            return self._send({'ok': True})

        return self._send({'error': 'Not found'}, 404)


if __name__ == '__main__':
    ensure_store()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'CineHome API running on http://{HOST}:{PORT}')
    server.serve_forever()
