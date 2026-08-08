FROM node:22-alpine

WORKDIR /usr/src/app

ARG GREETING="Hello from greeter v1"
ENV GREETING="$GREETING"

COPY package.json index.js ./

USER node

CMD ["npm", "start"]
