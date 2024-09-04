import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useValue } from "signia-react";
import { atom } from "signia";
import { produce } from "immer";
import { useMemo } from "react";

// --- DATA  -------------------------------------------------------------------
type Datum = (
  | { type: "list"; data: { items: string[] } }
  | { type: "card"; data: { title: string; description: string } }
  | { type: "stack"; data: Datum[] }
) & { id: number };

// Define the cards separately
const reactCard: Datum = {
  id: 3,
  type: "card",
  data: {
    title: "React",
    description: "A JavaScript library for building user interfaces",
  },
};

const viteCard: Datum = {
  id: 4,
  type: "card",
  data: {
    title: "Vite",
    description: "A build tool that aims to provide a faster and leaner development experience for modern web projects",
  },
};

const exampleData: Datum[] = [
  { id: 1, type: "list", data: { items: ["React", "Vite"] } },
  { id: 2, type: "list", data: { items: ["React", "Vite"] } },
  reactCard,
  viteCard,
  {
    id: 5,
    type: "stack",
    data: [reactCard, viteCard],
  },
];

// --- SURFACE PROVIDERS ------------------------------------------------------
type SurfaceProvider = (data: Datum) => React.ReactElement | undefined;

const ListProvider: SurfaceProvider = (datum) => {
  if (datum.type !== "list") return;

  return (
    <div className="container">
      <p>I am a list surface.</p>
      <ul>
        {datum.data.items.map((item, index) => (
          <li key={index}>
            <img src={item === "React" ? reactLogo : viteLogo} alt={`${item} logo`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CardProvider: SurfaceProvider = (datum) => {
  if (datum.type !== "card") return;

  return (
    <div className="container">
      <p>I am a card surface.</p>
      <h2>{datum.data.title}</h2>
      <p>{datum.data.description}</p>
    </div>
  );
};

const StackProvider: SurfaceProvider = (datum) => {
  if (datum.type !== "stack") return;

  return (
    <div className="container stack-container">
      <p>I am a stack surface.</p>
      <div className="stack-content">
        {datum.data.map((subDatum) => (
          <Surface key={subDatum.id} datum={subDatum} />
        ))}
      </div>
    </div>
  );
};

const surfaceProviders: SurfaceProvider[] = [ListProvider, CardProvider, StackProvider];

// --- Instance management ----------------------------------------------------
const surfaceInstances = {} as Record<number, number>;

const getSurfaceInstance = (id: number) => {
  if (!surfaceInstances[id]) {
    surfaceInstances[id] = 0;
  }
  return surfaceInstances[id]++;
};

// --- SURFACE COMPONENT ------------------------------------------------------

function Surface({ datum }: { datum: Datum }) {
  const { overlays } = useValue(state$);

  const provider = surfaceProviders.find((provider) => provider(datum));
  const instance = useMemo(() => getSurfaceInstance(datum.id), [datum.id]);

  if (!provider) {
    return (
      <div className="container">
        <p>Surface not found for datum</p>
        <pre>{JSON.stringify(datum, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="surface-wrapper">
      <div role="none" data-surfaceid={datum.id} data-surfacetype={datum.type} data-surfaceinstance={instance}>
        {provider(datum)}
      </div>
      {overlays && (
        <div className="surface-overlay">
          ID: <code>{datum.id}</code>, Type: <code>{datum.type}</code>, Instance: <code>{instance}</code>
        </div>
      )}
    </div>
  );
}

// --- APP LAND CODE ----------------------------------------------------------
const state$ = atom("state", { overlays: true });

function App() {
  return (
    <div role="main">
      <h1>Surface experiment ✨</h1>

      {exampleData.map((datum) => (
        <Surface key={datum.id} datum={datum} />
      ))}
    </div>
  );
}

export default App;
