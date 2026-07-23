FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js todo.js ./
CMD ["npm", "start"]
