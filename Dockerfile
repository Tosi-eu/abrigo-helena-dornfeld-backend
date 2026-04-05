# Build context: pasta backend/ (ver docker-compose: context ../backend)
FROM node:20-alpine

# libssl para o motor Prisma linux-musl-openssl-3.0.x (OpenSSL 3 no Alpine)
RUN apk add --no-cache curl postgresql-client openssl

WORKDIR /app

COPY package.json package-lock.json* ./
# postinstall roda prisma generate; o schema ainda não existe nesta camada
RUN npm install --legacy-peer-deps --ignore-scripts

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# sh: bind mount pode não marcar o script como executável
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
