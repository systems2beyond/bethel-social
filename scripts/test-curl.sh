#!/bin/bash

PROJECT_ID="bethel-metro-social"
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "Testing us-central1 gemini-1.5-flash..."
curl -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "https://us-central1-aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent" \
    -d '{
      "contents": [{
        "role": "user",
        "parts": [{ "text": "Hello" }]
      }]
    }'

echo -e "\n\nTesting us-central1 gemini-1.5-flash-001..."
curl -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "https://us-central1-aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/us-central1/publishers/google/models/gemini-1.5-flash-001:generateContent" \
    -d '{
      "contents": [{
        "role": "user",
        "parts": [{ "text": "Hello" }]
      }]
    }'

echo -e "\n\nTesting global gemini-1.5-flash..."
curl -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "https://aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/global/publishers/google/models/gemini-1.5-flash:generateContent" \
    -d '{
      "contents": [{
        "role": "user",
        "parts": [{ "text": "Hello" }]
      }]
    }'
