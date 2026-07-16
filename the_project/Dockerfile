# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY app ./app

CMD ["npm", "start"]
