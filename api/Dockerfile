FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache ffmpeg fontconfig

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY samples ./samples

RUN mkdir -p /usr/share/fonts/noto src/audio src/video \
    && wget -q -O /usr/share/fonts/noto/NotoSansDevanagari.ttf \
    "https://github.com/google/fonts/raw/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf" \
    && fc-cache -f

EXPOSE 8000

CMD ["node", "dist/server.js"]
