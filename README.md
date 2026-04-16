# Lead AI

AI real estate chatbot for qualifying leads, capturing contact details, and returning matching property options in a guided conversation.

## 1. Project Overview

- This project is a production-oriented real estate assistant for Visakhapatnam.
- It helps users describe what they want, narrows down property options, and captures lead details for human follow-up.
- The core chat experience is built around a deterministic step flow, with Supabase used for persistence and Gemini used for language assistance.

## 2. Tech Stack

- Frontend: Next.js 16 App Router with React 19.
- Backend: Next.js API routes.
- Database: Supabase Postgres.
- LLM: Gemini API.
- Styling: Tailwind CSS v4.
- Type safety: TypeScript.

## 3. Architecture Overview

- The UI sends chat input from the browser to `POST /api/chat`.
- The API loads the conversation from Supabase, hands the turn to `chatService`, and persists the updated state.
- `chatService` drives the step machine, property lookup, and lead capture.
- Gemini is used for structured extraction and response phrasing, while the step order stays deterministic.
- Matching properties and lead records are stored in Supabase.

## 4. Project Structure

The repo is organized at the root rather than under a `/src` directory.

- `app/` - Next.js app routes, layout, global styles, and the chat API route.
- `components/` - Reusable chat UI components such as the transcript, input, bubbles, cards, and quick replies.
- `hooks/` - Client-side chat state and request handling.
- `lib/` - Server and shared services for chat flow, LLM access, properties, leads, logging, and Supabase access.
- `types/` - Shared TypeScript types for chat and Supabase tables.
- `specs/` - Phase-by-phase product and implementation notes.
- `supabase/` - Local Supabase config, migrations, and seed data.
- `public/` - Static assets.
- `scripts/` - Local validation and stress-test helpers.

## 5. Database Schema

The project uses three core tables in Supabase.

### `conversations`

- `session_id` - conversation session key from the client.
- `step` - current chat step in the state machine.
- `collected_data` - JSON payload for captured intent, location, budget, property type, BHK, timeline, and lead data.
- `created_at` - timestamp when the conversation row was created.

### `properties`

- `title` - listing name.
- `location` - area or locality.
- `price` - property price in rupees.
- `type` - property category such as apartment, villa, plot, or commercial.
- `bhk` - configuration label such as 1BHK or 2BHK.

### `leads`

- `name` - captured lead name.
- `phone` - captured phone number.
- `intent` - buy, rent, or explore.
- `location` - preferred area.
- `budget_min` and `budget_max` - captured budget range.
- `property_type` - property category.
- `bhk` - configuration preference.
- `status` - lead status such as new or escalated.
- `timeline` - decision timeline.

## 6. Environment Variables

Create a local `.env.local` file with the required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

Optional for local scripts:

```bash
CHAT_BASE_URL=http://localhost:3000
DEBUG_MODE=true
```

## 7. Setup Instructions

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Create `.env.local` and set the environment variables above.
4. Make sure your Supabase project has the expected tables and sample property data.
5. Start the app with `npm run dev`.
6. Open `http://localhost:3000` in your browser.

If you are using local Supabase, run the Supabase stack with your normal local workflow before starting the app.

## 8. How the Chat System Works

- The conversation runs as a fixed step machine: `ASK_INTENT -> ASK_LOCATION -> ASK_BUDGET -> ASK_PROPERTY_TYPE -> ASK_CONFIG -> ASK_TIMELINE -> SHOW_RESULTS -> CAPTURE_NAME -> CAPTURE_PHONE -> ESCALATE -> DONE`.
- Each user message is tied to a `sessionId`, so the conversation can resume across requests.
- Collected values are accumulated in `collected_data` and persisted in the `conversations` table.
- The backend keeps the flow deterministic and uses LLM assistance only where needed for extraction and natural language response phrasing.
- When the user reaches results, the system queries `properties`, returns matches, then continues into lead capture and escalation.

## 9. API Overview

### `POST /api/chat`

Request body:

```json
{
	"sessionId": "...",
	"userMessage": "..."
}
```

Response body:

```json
{
	"response": "...",
	"step": "ASK_INTENT",
	"requiresEscalation": false,
	"isCompleted": false,
	"properties": [],
	"requestId": "...",
	"debug": {}
}
```

- The API returns the current step after processing the turn.
- `properties` is included when the flow reaches results.
- `debug` is only included when debug mode is enabled.

## 10. Current Status (Phase 1)

- Core chat flow implemented.
- Database integration working.
- Property retrieval working.
- Basic UI implemented.

## 11. Known Limitations

- Limited property dataset.
- Basic UI compared to the planned product experience.
- No multi-language support yet.
- Minimal optimization beyond the current foundation.

## 12. Next Steps

- Phase 2: multi-language support and UX improvements.
- Notification system for lead handoff.
- UI refinement and conversation experience polish.

## 13. Helpful Commands

```bash
npm run dev
npm run lint
npm run build
```

## 14. Notes for Developers

- The source of truth for conversation progress is the `conversations` record in Supabase.
- Use the generated types in `types/supabase.ts` instead of hand-writing table shapes.
- Keep chat changes aligned with the step machine in `types/chat.ts` and `lib/chatService.ts`.
