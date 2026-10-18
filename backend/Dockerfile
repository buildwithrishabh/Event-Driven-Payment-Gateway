# 1. Base Image (lightWeight & Secure)
FROM node:20-alpine

# 2. set working directory
WORKDIR /usr/src/app

# 3. Copy package files first to leverage Docker layer caching 
COPY package*.json ./

# 4. Install production dependencies 
RUN npm ci --omit=dev

# 5. Copy the rest of the application code 
COPY . .

# 6. Set environment to production 
ENV NODE_ENV=production

# 7. Expose the API port 
EXPOSE 3000

# 8. Run as non-root user for security 
USER node


# 9. Start the application 
CMD [ "node" , "src/app.js" ]
