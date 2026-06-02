FROM node:20-slim

# ffmpeg (with libx264/libass) + Roboto for burned-in captions
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-roboto \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY render.mjs server.mjs ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
