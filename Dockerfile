FROM node:20-alpine

RUN apk add --no-cache curl postgresql-client openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --ignore-scripts

COPY . .

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV STOKIO_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

RUN npx prisma generate && npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
