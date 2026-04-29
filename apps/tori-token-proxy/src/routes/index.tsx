import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Button } from "@repo/ui/components/button";
import { getRuntimeKey } from "hono/adapter";
export const Route = createFileRoute("/")({
  component: App,
  loader: () => {
    return getData();
  },
});

const getData = createServerFn().handler(() => {
  const rt = getRuntimeKey();
  if (rt === "deno") {
    return {
      runtime: rt,
      env: Deno.env.toObject(),
    };
  } else if (rt === "bun") {
    return {
      runtime: rt,
      env: Bun.env,
    };
  }
  return {
    runtime: rt,
    env: {
      env: 1,
    },
  };
});

function App() {
  const { runtime, env } = Route.useLoaderData();

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!, running on {runtime}</h1>
          {Object.keys(env).map((key) => (
            <div key={key}>
              {/*@ts-ignore*/}
              {key}: {env[key]}
            </div>
          ))}
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>
      </div>
    </div>
  );
}
