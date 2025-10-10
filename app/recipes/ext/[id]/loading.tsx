import RouteLoader from "@/components/ui/RouteLoader";

export default function Loading() {
  return <RouteLoader message="Loading external recipe" caption="Fetching the source..." />;
}
