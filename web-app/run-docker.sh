#!/bin/bash

# OnCuts Frontend - Docker Run Script
# Runs the Docker container with proper configuration

set -e  # Exit on error

echo "🚀 Starting OnCuts Frontend Container..."
echo ""

# Stop and remove existing container if running
if [ "$(docker ps -aq -f name=oncuts-frontend)" ]; then
    echo "🛑 Stopping existing container..."
    docker stop oncuts-frontend || true
    docker rm oncuts-frontend || true
fi

# Run the container
docker run -d \
  --name oncuts-frontend \
  --restart unless-stopped \
  -p 80:80 \
  oncuts-frontend:latest

echo ""
echo "✅ Container started successfully!"
echo ""
echo "📊 Container Status:"
docker ps | grep oncuts-frontend

echo ""
echo "🌐 Access the application at:"
echo "   http://localhost"
echo ""
echo "📝 View logs with:"
echo "   docker logs -f oncuts-frontend"
echo ""
echo "🛑 Stop the container with:"
echo "   docker stop oncuts-frontend"

