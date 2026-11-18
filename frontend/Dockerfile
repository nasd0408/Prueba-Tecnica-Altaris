# Stage 1: build the Angular bundle with Node.
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first so this layer is cached while only source files change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# Stage 2: only the static files + nginx end up in the final image (no Node at runtime).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
