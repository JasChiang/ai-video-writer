<br />

Rate limits regulate the number of requests you can make to the Gemini API within a given timeframe. These limits help maintain fair usage, protect against abuse, and help maintain system performance for all users.

[View your active rate limits in AI Studio](https://aistudio.google.com/usage?timeRange=last-28-days&tab=rate-limit)

## How rate limits work

Rate limits are usually measured across three dimensions:

- Requests per minute (**RPM**)
- Tokens per minute (input) (**TPM**)
- Requests per day (**RPD**)

Your usage is evaluated against each limit, and exceeding any of them will trigger a rate limit error. For example, if your RPM limit is 20, making 21 requests within a minute will result in an error, even if you haven't exceeded your TPM or other limits.

Rate limits are applied per project, not per API key.

Requests per day (**RPD**) quotas reset at midnight Pacific time.

Limits vary depending on the specific model being used, and some limits only apply to specific models. For example, Images per minute, or IPM, is only calculated for models capable of generating images (Imagen 3), but is conceptually similar to TPM. Other models might have a token per day limit (TPD).

Rate limits are more restricted for experimental and preview models.

## Usage tiers

Rate limits are tied to the project's usage tier. As your API usage and spending increase, you'll have an option to upgrade to a higher tier with increased rate limits.

The qualifications for Tiers 2 and 3 are based on the total cumulative spending on Google Cloud services (including, but not limited to, the Gemini API) for the billing account linked to your project.

|  Tier  |                                               Qualifications                                               |
|--------|------------------------------------------------------------------------------------------------------------|
| Free   | Users in[eligible countries](https://ai.google.dev/gemini-api/docs/available-regions)                      |
| Tier 1 | Billing account[linked to the project](https://ai.google.dev/gemini-api/docs/billing#enable-cloud-billing) |
| Tier 2 | Total spend: \> $250 and at least 30 days since successful payment                                         |
| Tier 3 | Total spend: \> $1,000 and at least 30 days since successful payment                                       |

When you request an upgrade, our automated abuse protection system performs additional checks. While meeting the stated qualification criteria is generally sufficient for approval, in rare cases an upgrade request may be denied based on other factors identified during the review process.

This system helps maintain the security and integrity of the Gemini API platform for all users.

## Standard API rate limits

The following table lists the rate limits for all standard Gemini API calls.
**Note:** Any values that show`*`have no published rate limits.  

### Free Tier

|                   Model                   | RPM |    TPM    |  RPD   |
|                          Text-out models                          ||||
|-------------------------------------------|-----|-----------|--------|
| Gemini 2.5 Pro                            | 2   | 125,000   | 50     |
| Gemini 2.5 Flash                          | 10  | 250,000   | 250    |
| Gemini 2.5 Flash Preview                  | 10  | 250,000   | 250    |
| Gemini 2.5 Flash-Lite                     | 15  | 250,000   | 1,000  |
| Gemini 2.5 Flash-Lite Preview             | 15  | 250,000   | 1,000  |
| Gemini 2.0 Flash                          | 15  | 1,000,000 | 200    |
| Gemini 2.0 Flash-Lite                     | 30  | 1,000,000 | 200    |
| Gemini 2.5 Flash Live                     | \*  | 1,000,000 | \*     |
| Gemini 2.5 Flash Preview Native Audio     | \*  | 500,000   | \*     |
| Gemini 2.0 Flash Live                     | \*  | 1,000,000 | \*     |
| Gemini 2.5 Flash Preview TTS              | 3   | 10,000    | 15     |
| Gemini 2.0 Flash Preview Image Generation | 10  | 200,000   | 100    |
| Gemma 3 \& 3n                             | 30  | 15,000    | 14,400 |
| Gemini Embedding                          | 100 | 30,000    | 1,000  |
| Gemini Robotics-ER 1.5 Preview            | 10  | 250,000   | 250    |
| Gemini 1.5 Flash (Deprecated)             | 15  | 250,000   | 50     |
| Gemini 1.5 Flash-8B (Deprecated)          | 15  | 250,000   | 50     |

### Tier 1

|                   Model                   |     RPM     |    TPM    |  RPD   | Batch Enqueued Tokens |
|                                         Text-out models                                          |||||
|-------------------------------------------|-------------|-----------|--------|-----------------------|
| Gemini 2.5 Pro                            | 150         | 2,000,000 | 10,000 | 5,000,000             |
| Gemini 2.5 Flash                          | 1,000       | 1,000,000 | 10,000 | 3,000,000             |
| Gemini 2.5 Flash Preview                  | 1,000       | 1,000,000 | 10,000 | 3,000,000             |
| Gemini 2.5 Flash-Lite                     | 4,000       | 4,000,000 | \*     | 10,000,000            |
| Gemini 2.5 Flash-Lite Preview             | 4,000       | 4,000,000 | \*     | 10,000,000            |
| Gemini 2.0 Flash                          | 2,000       | 4,000,000 | \*     | 10,000,000            |
| Gemini 2.0 Flash-Lite                     | 4,000       | 4,000,000 | \*     | 10,000,000            |
| Gemini 2.5 Flash Live                     | 50 sessions | 4,000,000 | \*     | \*                    |
| Gemini 2.5 Flash Preview Native Audio     | \*          | 1,000,000 | \*     | \*                    |
| Gemini 2.0 Flash Live                     | 50 sessions | 4,000,000 | \*     | \*                    |
| Gemini 2.5 Flash Preview TTS              | 10          | 10,000    | 100    | \*                    |
| Gemini 2.5 Pro Preview TTS                | 10          | 10,000    | 50     | \*                    |
| Gemini 2.5 Flash Image                    | 500         | 500,000   | 2,000  | \*                    |
| Gemini 2.0 Flash Preview Image Generation | 1,000       | 1,000,000 | 10,000 | \*                    |
| Imagen 4 Standard/Fast                    | 10          | \*        | 70     | \*                    |
| Imagen 4 Ultra                            | 5           | \*        | 30     | \*                    |
| Imagen 3                                  | 20          | \*        | \*     | \*                    |
| Veo 3.1                                   | 2           | \*        | 10     | \*                    |
| Veo 3.1 Fast                              | 2           | \*        | 10     | \*                    |
| Veo 3                                     | 2           | \*        | 10     | \*                    |
| Veo 3 Fast                                | 2           | \*        | 10     | \*                    |
| Veo 2                                     | 2           | \*        | 50     | \*                    |
| Gemma 3 \& 3n                             | 30          | 15,000    | 14,400 | \*                    |
| Gemini Embedding                          | 3,000       | 1,000,000 | \*     | \*                    |
| Gemini Robotics-ER 1.5 Preview            | 300         | 1,000,000 | 10,000 | \*                    |
| Gemini 2.5 Computer Use Preview           | 150         | 2,000,000 | 10,000 | \*                    |
| Gemini 1.5 Flash (Deprecated)             | 2,000       | 4,000,000 | \*     | \*                    |
| Gemini 1.5 Flash-8B (Deprecated)          | 4,000       | 4,000,000 | \*     | \*                    |
| Gemini 1.5 Pro (Deprecated)               | 1,000       | 4,000,000 | \*     | \*                    |

### Tier 2

|                   Model                   |      RPM       |    TPM     |   RPD   | Batch Enqueued Tokens |
|                                            Text-out models                                            |||||
|-------------------------------------------|----------------|------------|---------|-----------------------|
| Gemini 2.5 Pro                            | 1,000          | 5,000,000  | 50,000  | 500,000,000           |
| Gemini 2.5 Flash                          | 2,000          | 3,000,000  | 100,000 | 400,000,000           |
| Gemini 2.5 Flash Preview                  | 2,000          | 3,000,000  | 100,000 | 400,000,000           |
| Gemini 2.5 Flash-Lite                     | 10,000         | 10,000,000 | \*      | 500,000,000           |
| Gemini 2.5 Flash-Lite Preview             | 10,000         | 10,000,000 | \*      | 500,000,000           |
| Gemini 2.0 Flash                          | 10,000         | 10,000,000 | \*      | 1,000,000,000         |
| Gemini 2.0 Flash-Lite                     | 20,000         | 10,000,000 | \*      | 1,000,000,000         |
| Gemini 2.5 Flash Live                     | 1,000 sessions | 10,000,000 | \*      | \*                    |
| Gemini 2.5 Flash Preview Native Audio     | \*             | 10,000,000 | \*      | \*                    |
| Gemini 2.0 Flash Live                     | 1,000 sessions | 10,000,000 | \*      | \*                    |
| Gemini 2.5 Flash Preview TTS              | 1,000          | 100,000    | 10,000  | \*                    |
| Gemini 2.5 Pro Preview TTS                | 100            | 25,000     | 1,000   | \*                    |
| Gemini 2.5 Flash Image                    | 2,000          | 1,500,000  | 50,000  | \*                    |
| Gemini 2.0 Flash Preview Image Generation | 2,000          | 3,000,000  | 100,000 | \*                    |
| Imagen 4 Standard/Fast                    | 15             | \*         | 1000    | \*                    |
| Imagen 4 Ultra                            | 10             | \*         | 400     | \*                    |
| Imagen 3                                  | 20             | \*         | \*      | \*                    |
| Veo 3.1                                   | 4              | \*         | 50      | \*                    |
| Veo 3.1 Fast                              | 4              | \*         | 50      | \*                    |
| Veo 3                                     | 4              | \*         | 50      | \*                    |
| Veo 3 Fast                                | 4              | \*         | 50      | \*                    |
| Veo 2                                     | 2              | \*         | 50      | \*                    |
| Gemma 3 \& 3n                             | 30             | 15,000     | 14,400  | \*                    |
| Gemini Embedding                          | 5,000          | 5,000,000  | \*      | \*                    |
| Gemini Robotics-ER 1.5 Preview            | 400            | 3,000,000  | 100,000 | \*                    |
| Gemini 2.5 Computer Use Preview           | 1,000          | 5,000,000  | 50,000  | \*                    |
| Gemini 1.5 Flash (Deprecated)             | 2,000          | 4,000,000  | \*      | \*                    |
| Gemini 1.5 Flash-8B (Deprecated)          | 4,000          | 4,000,000  | \*      | \*                    |
| Gemini 1.5 Pro (Deprecated)               | 1,000          | 4,000,000  | \*      | \*                    |

### Tier 3

|                   Model                   |      RPM       |    TPM     |  RPD   | Batch Enqueued Tokens |
|                                           Text-out models                                            |||||
|-------------------------------------------|----------------|------------|--------|-----------------------|
| Gemini 2.5 Pro                            | 2,000          | 8,000,000  | \*     | 1,000,000,000         |
| Gemini 2.5 Flash                          | 10,000         | 8,000,000  | \*     | 1,000,000,000         |
| Gemini 2.5 Flash Preview                  | 10,000         | 8,000,000  | \*     | 1,000,000,000         |
| Gemini 2.5 Flash-Lite                     | 30,000         | 30,000,000 | \*     | 1,000,000,000         |
| Gemini 2.5 Flash-Lite Preview             | 30,000         | 30,000,000 | \*     | 1,000,000,000         |
| Gemini 2.0 Flash                          | 30,000         | 30,000,000 | \*     | 5,000,000,000         |
| Gemini 2.0 Flash-Lite                     | 30,000         | 30,000,000 | \*     | 5,000,000,000         |
| Gemini 2.5 Flash Live                     | 1,000 sessions | 10,000,000 | \*     | \*                    |
| Gemini 2.5 Flash Preview Native Audio     | \*             | 10,000,000 | \*     | \*                    |
| Gemini 2.0 Flash Live                     | 1,000 sessions | 10,000,000 | \*     | \*                    |
| Gemini 2.5 Flash Preview TTS              | 1,000          | 1,000,000  | \*     | \*                    |
| Gemini 2.5 Pro Preview TTS                | 100            | 1,000,000  | \*     | \*                    |
| Gemini 2.5 Flash Image                    | 5,000          | 5,000,000  | \*     | \*                    |
| Gemini 2.0 Flash Preview Image Generation | 5,000          | 5,000,000  | \*     | \*                    |
| Imagen 4 Standard/Fast                    | 20             | \*         | 15,000 | \*                    |
| Imagen 4 Ultra                            | 15             | \*         | 5,000  | \*                    |
| Imagen 3                                  | 20             | \*         | \*     | \*                    |
| Veo 3.1                                   | 10             | \*         | 500    | \*                    |
| Veo 3.1 Fast                              | 10             | \*         | 500    | \*                    |
| Veo 3                                     | 10             | \*         | 500    | \*                    |
| Veo 3 Fast                                | 10             | \*         | 500    | \*                    |
| Veo 2                                     | 2              | \*         | 50     | \*                    |
| Gemma 3 \& 3n                             | 30             | 15,000     | 14,400 | \*                    |
| Gemini Embedding                          | 10,000         | 10,000,000 | \*     | \*                    |
| Gemini Robotics-ER 1.5 Preview            | 600            | 8,000,000  | \*     | \*1,000,000,000\*     |
| Gemini 2.5 Computer Use Preview           | 2,000          | 8,000,000  | \*     | \*                    |
| Gemini 1.5 Flash (Deprecated)             | 2,000          | 4,000,000  | \*     | \*                    |
| Gemini 1.5 Flash-8B (Deprecated)          | 4,000          | 4,000,000  | \*     | \*                    |
| Gemini 1.5 Pro (Deprecated)               | 1,000          | 4,000,000  | \*     | \*                    |

Specified rate limits are not guaranteed and actual capacity may vary.

## Batch API rate limits

[Batch API](https://ai.google.dev/gemini-api/docs/batch-api)requests are subject to their own rate limits, separate from the non-batch API calls.

- **Concurrent batch requests:**100
- **Input file size limit:**2GB
- **File storage limit:**20GB
- **Enqueued tokens per model:** The**Batch Enqueued Tokens** column in the rate limits table lists the maximum number of tokens that can be enqueued for batch processing across all your active batch jobs for a given model. See in the[standard API rate limits table](https://ai.google.dev/gemini-api/docs/rate-limits#current-rate-limits).

## How to upgrade to the next tier

The Gemini API uses Cloud Billing for all billing services. To transition from the Free tier to a paid tier, you must first enable Cloud Billing for your Google Cloud project.

Once your project meets the specified criteria, it becomes eligible for an upgrade to the next tier. To request an upgrade, follow these steps:

- Navigate to the[API keys page](https://aistudio.google.com/app/apikey)in AI Studio.
- Locate the project you want to upgrade and click "Upgrade". The "Upgrade" option will only show up for projects that meet[next tier qualifications](https://ai.google.dev/gemini-api/docs/rate-limits#usage-tiers).

After a quick validation, the project will be upgraded to the next tier.

## Request a rate limit increase

Each model variation has an associated rate limit (requests per minute, RPM). For details on those rate limits, see[Gemini models](https://ai.google.dev/models/gemini).

[Request paid tier rate limit increase](https://forms.gle/ETzX94k8jf7iSotH9)

We offer no guarantees about increasing your rate limit, but we'll do our best to review your request.