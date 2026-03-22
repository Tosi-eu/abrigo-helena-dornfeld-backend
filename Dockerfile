FROM node:20-alpine

RUN apk add --no-cache curl postgresql-client

WORKDIR /repo

COPY sdk/package.json sdk/package-lock.json* ./sdk/
COPY sdk/tsconfig.json ./sdk/
COPY sdk/src ./sdk/src

RUN cd sdk && npm install && npm run build

COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /repo/backend
RUN npm install --legacy-peer-deps

COPY backend .

EXPOSE 3000

CMD ["npm", "run", "dev"]
