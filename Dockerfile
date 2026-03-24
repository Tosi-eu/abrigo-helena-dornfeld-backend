# Build context: pasta backend/ (ver docker-compose: context ../backend)
FROM node:20-alpine

RUN apk add --no-cache curl postgresql-client

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
