
# Treeline Tracker

Treeline Tracker is a modern, proof-of-concept web application designed for tracking and visualizing hiker group data in real-time. It provides a robust toolset for planning routes, monitoring group members, and ensuring safety during outdoor expeditions. The application is built with a focus on a scalable, feature-sliced architecture and a modern tech stack.

## 🚀 Key Features

*   **Real-time Hiker Tracking:** See live locations of group members on an interactive map.
*   **Group & Route Management:** Create, edit, and delete hiking groups and detailed routes.
*   **Interactive Map:** Visualize routes, hiker locations, and AI-suggested search areas.
*   **AI-Powered Search & Rescue:** Utilizes Genkit to provide AI-driven suggestions for finding lost hikers based on known data.
*   **Emergency Services:** A dedicated interface for critical situations, including sending location data and an emergency chat.
*   **Weather Forecast:** View current and forecasted weather for the hiking area.
*   **Responsive Design:** A seamless experience on both desktop and mobile devices.

## 📂 Project Structure (Feature-Sliced Design)

The project follows a **Feature-Sliced Design (FSD)** methodology. This architecture organizes the codebase by business domain rather than technical purpose, making it highly scalable and maintainable.

```
.
├── public/
│   └── ...            # Static assets (images, fonts, update.md)
├── src/
│   ├── app/           # (Layer) Routing, global layouts, and API routes
│   ├── views/         # (Layer) Complex pages or "widgets" composed of features and entities
│   ├── features/      # (Layer) User-facing features (e.g., group-management, route-drawing)
│   ├── entities/      # (Layer) Core business entities (e.g., Group, Route, Hiker)
│   └── shared/        # (Layer) Reusable code, UI components, and libraries
│       ├── api/       # Genkit flows and AI-related server actions
│       ├── config/    # Global configurations (e.g., Firebase)
│       ├── hooks/     # Shared React hooks
│       ├── lib/       # Shared utility functions (utils, map-utils)
│       └── ui/        # Shared, low-level UI components (from shadcn/ui)
├── .env.local         # Local environment variables
├── package.json
└── README.md
```

## 🛠️ Tech Stack

*   **[Next.js](https://nextjs.org/):** React framework for server-rendered and statically-generated web applications.
*   **[React](https://reactjs.org/):** JavaScript library for building user interfaces.
*   **[TypeScript](https://www.typescriptlang.org/):** Statically typed superset of JavaScript.
*   **[Tailwind CSS](https://tailwindcss.com/):** A utility-first CSS framework for rapid UI development.
*   **[Genkit](https://firebase.google.com/docs/genkit):** An open-source framework for building, deploying, and monitoring AI-powered features.
*   **[shadcn/ui](https://ui.shadcn.com/):** Re-usable UI components built on Radix UI and Tailwind CSS.
*   **[Leaflet](https://leafletjs.com/):** An open-source JavaScript library for interactive maps.
*   **[Recharts](https://recharts.org/):** A composable charting library built on React components.
*   **[Zod](https://zod.dev/):** TypeScript-first schema validation with static type inference.
*   **[Firebase](https://firebase.google.com/):** Platform for building and managing web and mobile applications (used for backend services).

## ⚡️ Getting Started

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/asakue/Treeline-Tracker.git
    cd Treeline-Tracker
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add your Gemini API key:
    ```
    GEMINI_API_KEY=YOUR_API_KEY
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📜 Available Scripts

*   `npm run dev`: Starts the application in development mode with Turbopack.
*   `npm run build`: Compiles the application for production.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Runs the linter to check for code quality issues.
*   `npm run typecheck`: Performs a TypeScript type check.
