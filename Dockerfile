FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app.js .
COPY package.json .


ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "app.js"]