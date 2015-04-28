FROM node

WORKDIR /app

ADD package.json /app/package.json

RUN npm install --production

ADD . /app

ENV PORT 5005

VOLUME ["/app/data", "/app/nginx"]

EXPOSE 5005

CMD ["node", "index.js"]
