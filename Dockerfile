FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN pip3 install --no-cache-dir --break-system-packages -r python/requirements-linux.txt

RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh && chmod +x scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=./data/piano-examiner.db
ENV UPLOAD_DIR=./data/uploads
ENV PYTHON_PATH=python3
ENV EVALUATION_MODE=auto

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
