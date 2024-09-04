import "./App.css";
import { useValue } from "signia-react";
import { atom } from "signia";
import { produce } from "immer";
import { createContext, RefObject, useContext, useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import classNames from "classnames";

// --- DATA  -------------------------------------------------------------------
type Datum = ({ type: "card"; data: { title: string; description: string } } | { type: "stack"; data: Datum[] }) & {
  id: number;
};

// Define the cards separately
const reactCard: Datum = {
  id: 0,
  type: "card",
  data: {
    title: "React",
    description: "A JavaScript library for building user interfaces",
  },
};

const viteCard: Datum = {
  id: 1,
  type: "card",
  data: {
    title: "Vite",
    description: "A build tool that aims to provide a faster and leaner development experience for modern web projects",
  },
};

const deepStack: Datum = {
  id: 5,
  type: "stack",
  data: [viteCard],
};

const stack: Datum = {
  id: 4,
  type: "stack",
  data: [reactCard, deepStack],
};

const anotherStack: Datum = {
  id: 3,
  type: "stack",
  data: [reactCard, viteCard, stack],
};

const exampleData: Datum[] = [
  reactCard,
  viteCard,
  {
    id: 2,
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

// --- SCROLL INTO VIEW -------------------------------------------------------
interface ScrollOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}

function useScrollIntoView(
  ref: RefObject<HTMLElement>,
  options: ScrollOptions = { behavior: "smooth", block: "center", inline: "nearest" },
) {
  const parentContext = useContext(SurfaceContext);
  const { focus } = useValue(state$);

  useEffect(() => {
    if (focus && parentContext && focus.id === parentContext.id && focus.instance === parentContext.instance) {
      ref.current?.scrollIntoView(options);
    }
  }, [focus, parentContext, ref, options]);
}

// --- USERLAND COMPONENTS -----------------------------------------------------
// Note: Types are nasty because I'm lazy.
const Card = ({ data }: { data: Extract<Datum, { type: "card" }>["data"] }) => {
  const focusRef = useRef<HTMLDivElement>(null);
  useScrollIntoView(focusRef);
  return (
    <div ref={focusRef} className="container card-container">
      <p>I am a card surface.</p>
      <div className="card-content">
        <h2>{data.title}</h2>
        <p>{data.description}</p>
      </div>
    </div>
  );
};

const Stack = ({ data }: { data: Extract<Datum, { type: "stack" }>["data"] }) => {
  const focusRef = useRef<HTMLDivElement>(null);
  useScrollIntoView(focusRef);

  return (
    <div ref={focusRef} className="container stack-container">
      <p>I am a stack surface.</p>
      <div className="stack-content">
        {data.map((datum) => (
          <Surface key={datum.id} datum={datum} />
        ))}
      </div>
    </div>
  );
};

// --- SURFACE PROVIDERS ------------------------------------------------------
type SurfaceProvider = (data: Datum) => React.ReactElement | undefined;

const CardProvider: SurfaceProvider = (datum) => {
  if (datum.type !== "card") return;
  return <Card data={datum.data} />;
};

const StackProvider: SurfaceProvider = (datum) => {
  if (datum.type !== "stack") return;
  return <Stack data={datum.data} />;
};

const surfaceProviders: SurfaceProvider[] = [CardProvider, StackProvider];

// --- Instance management ----------------------------------------------------
const surfaceInstances = {} as Record<number, number[]>;

const registerInstance = (id: number) => {
  if (!surfaceInstances[id] || surfaceInstances[id].length === 0) {
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

/**
 * Hook to manage surface instance IDs.
 *
 * This hook registers a new instance for a given datum ID when the component mounts,
 * and removes the instance when the component unmounts. */
const useSurfaceInstanceId = (id: number) => {
  const [surfaceInstance, setSurfaceInstance] = useState<number | undefined>();

  useEffect(() => {
    const instance = registerInstance(id);
    setSurfaceInstance(instance);
    return () => removeInstance(id, instance);
  }, [id]);

  return surfaceInstance;
};

/** A component that renders a surface based on the provided datum. */
function Surface({ datum }: { datum: Datum }) {
  const { overlays, focus } = useValue(state$);
  const parentContext = useContext(SurfaceContext);

  const provider = surfaceProviders.find((provider) => provider(datum));
  const surfaceInstance = useSurfaceInstanceId(datum.id);

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
      <div role="navigation" className="nav">
        <h1>Surface experiment ✨</h1>

        <div role="none" className="flex flex-row gap-2">
          {Array.from(collectIds(exampleData)).map((id) => (
            <button key={id} onClick={() => dispatch({ type: "FOCUS_SURFACE", surfaceId: id })}>
              {id}
            </button>
          ))}
        </div>
      </div>

      {exampleData.map((datum) => (
        <Surface key={datum.id} datum={datum} />
      ))}
    </div>
  );
}

export default App;
