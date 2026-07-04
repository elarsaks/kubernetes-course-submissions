# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY todo-app ./todo-app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
