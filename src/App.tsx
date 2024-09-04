import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useValue } from "signia-react";
import { atom } from "signia";
import { produce } from "immer";
import { createContext, useContext, useEffect, useState } from "react";
import { match } from "ts-pattern";
import classNames from "classnames";

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

const deepStack: Datum = {
  id: 8,
  type: "stack",
  data: [viteCard],
};

const stack: Datum = {
  id: 7,
  type: "stack",
  data: [reactCard, deepStack],
};

const anotherStack: Datum = {
  id: 6,
  type: "stack",
  data: [reactCard, viteCard, stack],
};

const exampleData: Datum[] = [
  reactCard,
  viteCard,
  {
    id: 5,
    type: "stack",
    data: [reactCard, viteCard, anotherStack, deepStack],
  },
];

// --- DATA UTILITIES ----------------------------------------------------------
const collectIds = (data: Datum[]): Set<number> => {
  return new Set(
    data.flatMap((datum) =>
      match(datum)
        .with({ type: "stack" }, (stack) => [stack.id, ...collectIds(stack.data)])
        .otherwise((d) => [d.id]),
    ),
  );
};

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
    <div className="container card">
      <p>
        I am a <strong>card</strong> surface.
      </p>
      <h2>{datum.data.title}</h2>
      <p>{datum.data.description}</p>
    </div>
  );
};

const StackProvider: SurfaceProvider = (datum) => {
  if (datum.type !== "stack") return;

  return (
    <div className="container stack-container">
      <p>
        I am a <strong>stack</strong> surface.
      </p>
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
const surfaceInstances = {} as Record<number, number[]>;

const registerInstance = (id: number) => {
  if (!surfaceInstances[id]) {
    surfaceInstances[id] = [0];
    return 0;
  }

  if (surfaceInstances[id].length === 0) {
    surfaceInstances[id] = [0];
    return 0;
  }

  const instance = Math.max(...surfaceInstances[id]) + 1;
  surfaceInstances[id].push(instance);
  return instance;
};

const removeInstance = (id: number, instance: number) => {
  if (!surfaceInstances[id]) return;

  const index = surfaceInstances[id].indexOf(instance);
  if (index !== -1) {
    surfaceInstances[id].splice(index, 1);
  }
};

const getInstances = (id: number) => surfaceInstances[id] ?? [];
const nextInstance = (id: number, instance: number) => {
  const instances = getInstances(id);
  const index = instances.indexOf(instance);
  return instances[index + 1] ?? instances[0];
};

// --- SURFACE COMPONENT ------------------------------------------------------
const SurfaceContext = createContext<{ id: number; instance: number } | null>(null);

function Surface({ datum }: { datum: Datum }) {
  const { overlays, focus } = useValue(state$);
  const parentContext = useContext(SurfaceContext);

  const provider = surfaceProviders.find((provider) => provider(datum));
  const [surfaceInstance, setSurfaceInstance] = useState<number | undefined>();

  useEffect(() => {
    const instance = registerInstance(datum.id);
    setSurfaceInstance(instance);
    return () => removeInstance(datum.id, instance);
  }, [datum.id]);

  if (!provider) {
    return (
      <div className="container">
        <p>Surface not found for datum</p>
        <pre>{JSON.stringify(datum, null, 2)}</pre>
      </div>
    );
  }

  const classes = classNames("surface-wrapper", {
    "surface-focused": focus?.id === datum.id && focus?.instance === surfaceInstance,
  });

  return (
    <SurfaceContext.Provider value={{ id: datum.id, instance: surfaceInstance! }}>
      <div className={classes}>
        <div role="none" data-surfaceid={datum.id} data-surfacetype={datum.type} data-surfaceinstance={surfaceInstance}>
          {provider(datum)}
        </div>
        {overlays && (
          <div className="surface-overlay">
            Coord:{" "}
            <code>
              {datum.id}:{surfaceInstance}
            </code>
            {parentContext && (
              <>
                , Parent:{" "}
                <code>
                  {parentContext.id}:{parentContext.instance}
                </code>
              </>
            )}
          </div>
        )}
      </div>
    </SurfaceContext.Provider>
  );
}

// --- APP LAND CODE ----------------------------------------------------------
type AppState = {
  overlays: boolean;
  focus?: { id: number; instance?: number };
};

const state$ = atom<AppState>("state", { overlays: true });

type AppEvent = { type: "FOCUS_SURFACE"; surfaceId: number };

const dispatch = (event: AppEvent) => {
  console.log("Dispatching event", event);

  switch (event.type) {
    case "FOCUS_SURFACE": {
      state$.update((state) =>
        produce(state, (draft) => {
          if (draft.focus?.id === event.surfaceId) {
            // If the same surface is focused, move to the next instance
            const next = nextInstance(event.surfaceId, draft.focus.instance!);
            draft.focus = { id: event.surfaceId, instance: next };
            return;
          }

          console.log("Different!");
          const firstInstance = getInstances(event.surfaceId).at(0)!;
          draft.focus = {
            id: event.surfaceId,
            instance: firstInstance,
          };
        }),
      );
      break;
    }
  }
};

function App() {
  return (
    <div role="main" className="flex flex-column gap-2">
      <h1>Surface experiment ✨</h1>

      <div role="none" className="flex flex-row gap-2">
        {Array.from(collectIds(exampleData)).map((id) => (
          <button key={id} onClick={() => dispatch({ type: "FOCUS_SURFACE", surfaceId: id })}>
            {id}
          </button>
        ))}
      </div>

      {exampleData.map((datum) => (
        <Surface key={datum.id} datum={datum} />
      ))}
    </div>
  );
}

export default App;
