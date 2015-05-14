FROM mhart/alpine-node

WORKDIR /app

ADD package.json /app/package.json

RUN npm install --production

ADD . /app

ENV PORT 5005

EXPOSE 5005

CMD ["node", "index.js"]
