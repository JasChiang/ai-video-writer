# Gemini Developer API

[Get a Gemini API Key](https://aistudio.google.com/apikey)

Get a Gemini API key and make your first API request in minutes.  

### Python

    from google import genai

    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Explain how AI works in a few words",
    )

    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Explain how AI works in a few words",
      });
      console.log(response.text);
    }

    await main();

### Go

    package main

    import (
        "context"
        "fmt"
        "log"
        "google.golang.org/genai"
    )

    func main() {
        ctx := context.Background()
        client, err := genai.NewClient(ctx, nil)
        if err != nil {
            log.Fatal(err)
        }

        result, err := client.Models.GenerateContent(
            ctx,
            "gemini-2.5-flash",
            genai.Text("Explain how AI works in a few words"),
            nil,
        )
        if err != nil {
            log.Fatal(err)
        }
        fmt.Println(result.Text())
    }

### Java

    package com.example;

    import com.google.genai.Client;
    import com.google.genai.types.GenerateContentResponse;

    public class GenerateTextFromTextInput {
      public static void main(String[] args) {
        Client client = new Client();

        GenerateContentResponse response =
            client.models.generateContent(
                "gemini-2.5-flash",
                "Explain how AI works in a few words",
                null);

        System.out.println(response.text());
      }
    }

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d '{
        "contents": [
          {
            "parts": [
              {
                "text": "Explain how AI works in a few words"
              }
            ]
          }
        ]
      }'

## Meet the models


[Start building with Gemini](https://aistudio.google.com/apps)  

2.5 Pro
spark


Our most powerful thinking model with features for complex reasoning and much more
[](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-pro)  

2.5 Flash
spark


Our most balanced model, with a 1 million token context window and more
[](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2.5-flash)  

2.5 Flash-Lite
spark


Our fastest and most cost-efficient multimodal model with great performance
for high-frequency tasks
[](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2.5-flash-lite)  

Veo 3
video_library


Our state of the art video generation model, with native audio
[](https://ai.google.dev/gemini-api/docs/video)  

Gemini 2.5 Flash Image
imagesmode


(Nano Banana), our highly effective and precise image generation model
[](https://ai.google.dev/gemini-api/docs/image-generation)  

Gemini Embeddings
data_array


Our first Gemini embedding model, designed for production RAG workflows
[](https://ai.google.dev/gemini-api/docs/embeddings)

## Explore the API

![](https://ai.google.dev/static/site-assets/images/image-generation-index.png)  

### Native Image Generation (aka Nano Banana)

Generate and edit highly contextual images natively with Gemini 2.5 Flash Image.
[](https://ai.google.dev/gemini-api/docs/image-generation)  
![](https://ai.google.dev/static/site-assets/images/long-context-overview.png)  

### Explore long context

Input millions of tokens to Gemini models and derive understanding from unstructured images, videos, and documents.
[](https://ai.google.dev/gemini-api/docs/long-context)  
![](https://ai.google.dev/static/site-assets/images/structured-outputs-index.png)  

### Generate structured outputs

Constrain Gemini to respond with JSON, a structured data format suitable for automated processing.
[](https://ai.google.dev/gemini-api/docs/structured-output)  

### Start building with the Gemini API

[Get started](https://ai.google.dev/gemini-api/docs/quickstart)