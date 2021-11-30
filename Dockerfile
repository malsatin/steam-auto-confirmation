FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# mount config.json via -v $(pwd)/config.json:/usr/src/app/config.json
CMD [ "node", "index.js" ]