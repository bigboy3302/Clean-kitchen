import EditorClient from "./EditorClient";

type PageProps = {
  params: { id: string };
};

export default async function Page({ params }: PageProps) {
  void params;
  return <EditorClient initial={null} />;
}
