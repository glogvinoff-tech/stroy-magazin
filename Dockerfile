FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY public ./public
COPY src ./src
RUN npm run build
# Copy photos to build directory for serving on Render
RUN mkdir -p /app/build/photo && cp -r /app/public/photo/* /app/build/photo/ 2>/dev/null || true

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# GigaChat OAuth (ngw.devices.sberbank.ru:9443) may require Russian trusted CAs (Минцифры).
# Install them into the system trust store so standard SSL verification works.
RUN python - <<'PY'
import pathlib
import ssl
import urllib.request

URLS = {
    "russian_trusted_root_ca_pem.crt": "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt",
    "russian_trusted_sub_ca_pem.crt": "https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt",
}

out_dir = pathlib.Path("/usr/local/share/ca-certificates/russian-trusted")
out_dir.mkdir(parents=True, exist_ok=True)

ctx = ssl._create_unverified_context()
for name, url in URLS.items():
    data = urllib.request.urlopen(url, context=ctx, timeout=30).read()
    (out_dir / name).write_bytes(data)

print("Installed:", ", ".join(URLS.keys()))
PY
RUN update-ca-certificates

COPY backend /app/backend
COPY --from=frontend /app/build /app/build

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
