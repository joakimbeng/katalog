FROM dockerfile/nodejs

WORKDIR /app

ADD package.json /app/package.json

RUN npm install --production

ADD src /app/src
ADD tpl /app/tpl
ADD index.js /app/index.js

ENV PORT 5005

VOLUME ["/app/data", "/app/nginx"]

EXPOSE 5005

CMD ["node", "index.js"]
