# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy all source code and config files
COPY . .

# Build the project (generates the dist folder)
RUN npm run build

# Production Stage
FROM node:18-alpine AS runner

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --production

# Copy the compiled output from the builder stage
COPY --from=builder /app/dist ./dist

# Render automatically provides a PORT environment variable
EXPOSE 5000

# Start the application
CMD ["npm", "start"]