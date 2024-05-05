FROM node:18-alpine

RUN mkdir -p /app

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY public ./public
COPY views ./views
COPY index.js ./

ENTRYPOINT ["node", "index.js"]