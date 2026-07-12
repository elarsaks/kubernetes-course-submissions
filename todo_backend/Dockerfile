FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
COPY index.js ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
