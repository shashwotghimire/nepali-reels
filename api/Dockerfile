FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache ffmpeg fontconfig ttf-dejavu

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY samples ./samples

RUN mkdir -p src/audio src/video

EXPOSE 8000

CMD ["node", "dist/server.js"]
