FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown -R node:node /app
ENV NODE_ENV=production
USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["npm","start"]
