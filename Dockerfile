FROM node:20-alpine

RUN apk add --no-cache curl postgresql-client

WORKDIR /repo

COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /repo/backend
RUN npm install --legacy-peer-deps

COPY backend .

EXPOSE 3000

CMD ["npm", "run", "dev"]
