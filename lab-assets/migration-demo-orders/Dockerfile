FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "--input-type=module", "-e", "import('./src/orders.js').then(() => console.log('orders service ready'))"]
