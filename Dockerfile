FROM node:22-slim
WORKDIR /app

# install + seed + build (postinstall seeds; build re-seeds and builds the client)
COPY . .
RUN npm install && npm run build

ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]
